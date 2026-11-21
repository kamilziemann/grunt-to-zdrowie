// Obrazy pola z satelity: kondycja roslin (NDVI Sentinel-2) dla wybranych dzialek, gotowa do polozenia na mapie
// (PNG na dzialke jako data URL + narozniki, wspolna skala kolorow dla calego pola). Pokaz trybu 3D (docs/progress/2026-11-21/tryb-3d-poc.md) - serwis nie zna HTTP ani
// formatu uslugi satelitarnej.
import { PROBLEM_CODES } from '@app/contracts';
import { AppError } from '@app/http';

import { addDays, isoDateInPoland } from '../../domain/iso-date';
import { boundingBox, type BoundingBox, type PolygonGeometry } from '../../domain/parcel-geometry';
import type { ParcelGeometryLookup, VegetationImagerySource } from './ports';

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

export interface VegetationImageryResult {
  /** obraz na dzialke: PNG jako data URL (strona kladzie go na mapie bez drugiego zapytania) i jego narozniki */
  images: { image: string; bbox: BoundingBox }[];
  /** zasieg wszystkich obrazow: [zachod, poludnie, wschod, polnoc] w WGS84 */
  bbox: BoundingBox;
  requestedDate: string;
  sceneDate: string;
  sceneCloudCover: number;
  clearShare: number;
  ndvi: { low: number; high: number; mean: number };
}

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
    }): Promise<VegetationImageryResult> {
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
      const parts = found.map((parcel) => ({ geometry: parcel.geometry, bbox: paddedBbox(parcel.geometry) }));
      const image = await source.render({ parts, date, windowDays: SCENE_WINDOW_DAYS });

      if (!image) {
        throw new AppError(
          PROBLEM_CODES.NOT_FOUND,
          `No clear Sentinel-2 scene between ${addDays(date, -SCENE_WINDOW_DAYS)} and ${date}`,
          { reason: 'no_clear_scene' },
        );
      }

      const boxes = image.tiles.map((tile) => tile.bbox);

      return {
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
        ndvi: { low: image.ndviLow, high: image.ndviHigh, mean: image.ndviMean },
      };
    },
  };
}

export type ImageryService = ReturnType<typeof createImageryService>;
