// Obrazy pola z satelity: kondycja roslin (NDVI) albo woda w roslinach (NDMI) z Sentinel-2 dla wybranych dzialek,
// gotowe do polozenia na mapie (PNG na dzialke jako data URL + narozniki, wspolna skala kolorow dla calego pola).
// Tryb "Woda na polu w 3D" (eksperymentalny) - serwis nie zna HTTP ani formatu uslugi satelitarnej.
import { PROBLEM_CODES, type ImageryLayer, type VegetationImagery } from '@app/contracts';
import { AppError } from '@app/http';

import { addDays, isoDateInPoland } from '../../domain/iso-date';
import { boundingBox, type BoundingBox, type PolygonGeometry } from '../../domain/parcel-geometry';
import { mergeParcels } from './merge-parcels';
import type { ParcelGeometryLookup, VegetationImagerySource, VegetationIndex } from './ports';

/** Ile dni przed wybranym dniem szukamy zdjecia bez chmur (Sentinel-2 przelatuje co 2-5 dni). */
export const SCENE_WINDOW_DAYS = 30;
/** Margines zasiegu obrazu wokol pola (czesc szerokosci): obrys nie dotyka krawedzi obrazu. */
const BBOX_MARGIN = 0.04;
/** Pierwsze sceny Sentinel-2 L2A nad Polska. */
const FIRST_SCENE_DATE = '2017-04-01';

export interface ImageryServiceDeps {
  parcels: ParcelGeometryLookup;
  source: VegetationImagerySource;
  now: () => string;
}

export type VegetationImageryResult = VegetationImagery;

/** Warstwa obrazu (slowo z API) -> wskaznik liczony z pasm Sentinel-2. */
const LAYER_INDEX: Record<ImageryLayer, VegetationIndex> = { condition: 'ndvi', moisture: 'ndmi' };

export function paddedBbox(geometry: PolygonGeometry): BoundingBox {
  const [west, south, east, north] = boundingBox(geometry);
  const padX = (east - west) * BBOX_MARGIN;
  const padY = (north - south) * BBOX_MARGIN;

  return [west - padX, south - padY, east + padX, north + padY];
}

/** Bajty -> base64 w kawalkach (spread calego obrazu przekroczylby limit argumentow funkcji). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

export function createImageryService({ parcels, source, now }: ImageryServiceDeps) {
  return {
    async vegetation(input: {
      parcelIds: readonly string[];
      date?: string;
      layer?: ImageryLayer;
    }): Promise<VegetationImageryResult> {
      const layer = input.layer ?? 'condition';
      const today = isoDateInPoland(now());
      const date = input.date ?? today;

      if (input.parcelIds.length === 0) {
        throw AppError.validation([{ path: 'dzialki', message: 'at least one parcel id is required' }]);
      }

      if (date > today || date < FIRST_SCENE_DATE) {
        throw AppError.validation([
          { path: 'data', message: `date must be between ${FIRST_SCENE_DATE} and ${today}` },
        ]);
      }

      const found = await Promise.all(input.parcelIds.map((id) => parcels.get(id)));
      // sasiednie dzialki jako jedno pole = jedno zapytanie o statystyki i jeden obraz; gdy sie nie skladaja - osobno
      const merged = found.length > 1 ? mergeParcels(found.map((parcel) => parcel.geometry)) : null;
      const geometries = merged ? [merged] : found.map((parcel) => parcel.geometry);
      const parts = geometries.map((geometry) => ({ geometry, bbox: paddedBbox(geometry) }));
      const image = await source.render({
        parts,
        index: LAYER_INDEX[layer],
        date,
        windowDays: SCENE_WINDOW_DAYS,
      });

      if (!image) {
        throw new AppError(
          PROBLEM_CODES.NOT_FOUND,
          `No clear Sentinel-2 scene between ${addDays(date, -SCENE_WINDOW_DAYS)} and ${date}`,
          { reason: 'no_clear_scene' },
        );
      }

      const boxes = image.tiles.map((tile) => tile.bbox);

      return {
        layer,
        images: image.tiles.map((tile) => ({
          image: `data:image/png;base64,${toBase64(tile.png)}`,
          bbox: tile.bbox,
        })),
        bbox: [
          Math.min(...boxes.map((box) => box[0])),
          Math.min(...boxes.map((box) => box[1])),
          Math.max(...boxes.map((box) => box[2])),
          Math.max(...boxes.map((box) => box[3])),
        ],
        requestedDate: date,
        sceneDate: image.sceneDate,
        sceneCloudCover: image.sceneCloudCover,
        clearShare: image.clearShare,
        scale: { low: image.low, high: image.high, mean: image.mean },
      };
    },
  };
}

export type ImageryService = ReturnType<typeof createImageryService>;
