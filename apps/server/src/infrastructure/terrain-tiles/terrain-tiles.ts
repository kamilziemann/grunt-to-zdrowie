// Adapter TerrainSource na kaflach wysokosci Terrain Tiles (AWS Open Data, format "terrarium": PNG 256 x 256,
// wysokosc = R * 256 + G + B / 256 - 32768 m, Web Mercator). W Polsce kafle pochodza z EU-DEM / SRTM (ok. 25-30 m),
// wiec siatka obliczen (piksel kafla, 3-12 m) jest gestsza niz dane - SourceRef i ograniczenie `terrain_coarse` mowia
// to wprost dla malych pol. Copernicus DEM GLO-30 (COG na AWS) odpadl: kafle COG maja 1024 x 1024 Float32 (MB na
// pole) - za duzo dla Workera. Pochodne (spadek, zaglebienia, TWI) licza czyste funkcje z domain/terrain.
import type { FieldArea, SourceRef } from '@app/contracts';

import type { Sourced, TerrainData, TerrainGrid, TerrainSource } from '../../domain/analysis-ports';
import { containsPoint } from '../../domain/parcel-geometry';
import { summarizeTerrain, TERRAIN_MODEL_RESOLUTION_M, terrainTooCoarse } from '../../domain/terrain';
import { failureNote, httpFailureNote, polishPlural } from '../../lib/source-note';
import { OUTBOUND_USER_AGENT } from '../../lib/user-agent';
import { decodePng } from './png';

export const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

const PROVIDER = 'Terrain Tiles (AWS Open Data, terrarium) - EU-DEM / SRTM';
const LICENCE =
  'dane otwarte; podać: EU-DEM (Copernicus), SRTM (NASA), opracowanie kafli: Mapzen / AWS Terrain Tiles';
const TILE_PX = 256;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** margines wokol pola: woda doplywa spoza granicy, a stok i zaglebienie potrzebuja sasiedztwa */
const MARGIN_M = 100;
/** najwiecej komorek siatki - wieksze pole dostaje mniejsze przyblizenie kafli */
const MAX_CELLS = 60_000;
const MAX_ZOOM = 15;
const MIN_ZOOM = 11;
const TIMEOUT_MS = 6000;

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers?: Record<string, string> },
) => Promise<Response>;

export interface TerrainTilesOptions {
  fetch?: FetchLike;
  now?: () => string;
}

const worldPx = (zoom: number): number => TILE_PX * 2 ** zoom;

export function lngToPx(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * worldPx(zoom);
}

export function latToPx(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;

  return ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * worldPx(zoom);
}

const pxToLng = (px: number, zoom: number): number => (px / worldPx(zoom)) * 360 - 180;

const pxToLat = (py: number, zoom: number): number =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / worldPx(zoom)))) * 180) / Math.PI;

/** Bok piksela kafla w metrach na danej szerokosci. */
export const pixelSizeM = (lat: number, zoom: number): number =>
  (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / worldPx(zoom);

interface PixelWindow {
  zoom: number;
  px0: number;
  py0: number;
  cols: number;
  rows: number;
}

/** Okno pikseli obejmujace pole z marginesem - najwieksze przyblizenie, przy ktorym siatka nie przekracza limitu. */
export function pixelWindow(bbox: FieldArea['bbox']): PixelWindow {
  const [west, south, east, north] = bbox;
  const lat = (south + north) / 2;

  for (let zoom = MAX_ZOOM; ; zoom -= 1) {
    const margin = MARGIN_M / pixelSizeM(lat, zoom);
    const px0 = Math.floor(lngToPx(west, zoom) - margin);
    const px1 = Math.ceil(lngToPx(east, zoom) + margin);
    const py0 = Math.floor(latToPx(north, zoom) - margin);
    const py1 = Math.ceil(latToPx(south, zoom) + margin);
    const window = { zoom, px0, py0, cols: px1 - px0, rows: py1 - py0 };

    if (window.cols * window.rows <= MAX_CELLS || zoom <= MIN_ZOOM) return window;
  }
}

export const tileUrl = (zoom: number, x: number, y: number): string =>
  `${TERRARIUM_URL}/${zoom}/${x}/${y}.png`;

/** Wysokosci kafla w metrach (wierszami). */
async function tileHeights(response: Response): Promise<Float64Array> {
  const image = await decodePng(await response.arrayBuffer());
  const heights = new Float64Array(image.width * image.height);

  for (let index = 0; index < heights.length; index += 1) {
    const at = index * image.channels;
    const red = image.pixels[at] ?? 0;
    const green = image.pixels[at + 1] ?? 0;
    const blue = image.pixels[at + 2] ?? 0;

    heights[index] = red * 256 + green + blue / 256 - 32_768;
  }

  return heights;
}

/** Komorki siatki, ktorych srodek lezy w polu; gdy zadna (pole mniejsze od komorki) - komorka najblizsza srodkowi. */
function fieldMask(window: PixelWindow, field: FieldArea): boolean[] {
  const centre = (index: number): [number, number] => [
    pxToLng(window.px0 + (index % window.cols) + 0.5, window.zoom),
    pxToLat(window.py0 + Math.floor(index / window.cols) + 0.5, window.zoom),
  ];
  const mask = Array.from({ length: window.cols * window.rows }, (_unused, index) =>
    containsPoint(field.geometry, centre(index)),
  );

  if (mask.includes(true)) return mask;

  const col = Math.floor(lngToPx(field.centroid[0], window.zoom)) - window.px0;
  const row = Math.floor(latToPx(field.centroid[1], window.zoom)) - window.py0;

  mask[row * window.cols + col] = true;

  return mask;
}

class TerrainFailure extends Error {}

export function createTerrainTilesSource({
  fetch: fetchImpl = (url, init) => fetch(url, init),
  now = () => new Date().toISOString(),
}: TerrainTilesOptions = {}): TerrainSource {
  return {
    async terrain(field): Promise<Sourced<TerrainData>> {
      const window = pixelWindow(field.bbox);
      const tiles: { x: number; y: number }[] = [];

      for (
        let y = Math.floor(window.py0 / TILE_PX);
        y <= Math.floor((window.py0 + window.rows - 1) / TILE_PX);
        y += 1
      )
        for (
          let x = Math.floor(window.px0 / TILE_PX);
          x <= Math.floor((window.px0 + window.cols - 1) / TILE_PX);
          x += 1
        )
          tiles.push({ x, y });

      const base: SourceRef = {
        id: 'terrain',
        provider: PROVIDER,
        status: 'missing',
        sample: false,
        licence: LICENCE,
        url: tileUrl(window.zoom, tiles[0]?.x ?? 0, tiles[0]?.y ?? 0),
        fetchedAt: now(),
      };
      const signal = AbortSignal.timeout(TIMEOUT_MS);
      const loaded = await Promise.all(
        tiles.map(async (tile) => {
          const response = await fetchImpl(tileUrl(window.zoom, tile.x, tile.y), {
            signal,
            headers: { 'user-agent': OUTBOUND_USER_AGENT },
          });

          if (!response.ok) throw new TerrainFailure(httpFailureNote('Terrain Tiles', response.status));

          return { x: tile.x, y: tile.y, heights: await tileHeights(response) };
        }),
      ).catch((error: unknown) =>
        error instanceof TerrainFailure ? error : new TerrainFailure(failureNote('Terrain Tiles', error)),
      );

      if (loaded instanceof Error) return { data: null, source: { ...base, note: loaded.message } };

      const elevationM = Array.from({ length: window.cols * window.rows }, (_unused, index) => {
        const px = window.px0 + (index % window.cols);
        const py = window.py0 + Math.floor(index / window.cols);
        const tile = loaded.find(
          (item) => item.x === Math.floor(px / TILE_PX) && item.y === Math.floor(py / TILE_PX),
        );

        return tile?.heights[(py % TILE_PX) * TILE_PX + (px % TILE_PX)] ?? 0;
      });
      const cellSizeM = pixelSizeM(field.centroid[1], window.zoom);
      const crsCell = EARTH_CIRCUMFERENCE_M / worldPx(window.zoom);
      const grid: TerrainGrid = {
        crs: 'EPSG:3857',
        originX: window.px0 * crsCell - EARTH_CIRCUMFERENCE_M / 2,
        originY: EARTH_CIRCUMFERENCE_M / 2 - window.py0 * crsCell,
        cellSizeM,
        crsCellSize: crsCell,
        cols: window.cols,
        rows: window.rows,
        elevationM,
      };
      const summary = summarizeTerrain(grid, fieldMask(window, field));
      const modelCells = Math.max(1, Math.round((field.areaHa * 10_000) / TERRAIN_MODEL_RESOLUTION_M ** 2));
      const coarse = terrainTooCoarse(field.areaHa);
      const cells = `${modelCells} ${polishPlural(modelCells, 'komórka', 'komórki', 'komórek')}`;

      return {
        data: { grid, summary },
        source: {
          ...base,
          status: 'ok',
          resolution: `model ok. ${TERRAIN_MODEL_RESOLUTION_M} m (EU-DEM / SRTM), siatka obliczeń ${cellSizeM.toFixed(1).replace('.', ',')} m`,
          note: coarse
            ? `pole to ok. ${cells} modelu ${TERRAIN_MODEL_RESOLUTION_M} m — spadek to przybliżenie, małe zagłębienia i krótkie stoki mogą być niewidoczne; sprawdź w terenie`
            : `pole to ok. ${cells} modelu ${TERRAIN_MODEL_RESOLUTION_M} m; drobne formy terenu (bruzdy, uwrocia) są niewidoczne`,
        },
      };
    },
  };
}
