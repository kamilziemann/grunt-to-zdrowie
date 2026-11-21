// Przypadki uzycia dzialek ewidencyjnych: znajdz po identyfikatorze, po punkcie na mapie albo po "obreb numer".
// Zrodlo (ULDK) przychodzi jako port; serwis dolicza bbox, srodek i powierzchnie z geometrii.
import {
  PARCEL_ID_PATTERN,
  PARCEL_BOUNDARY_TILE_ZOOM,
  PARCEL_LIMITS,
  type Parcel,
  type ParcelBoundaries,
  type ParcelBoundaryTileZoom,
  type ParcelCandidate,
  type ParcelSearchResult,
} from '@app/contracts';
import { AppError } from '@app/http';

import { areaSquareMeters, boundingBox, centroid } from '../../domain/parcel-geometry';
import { tileBounds } from '../../domain/tile-bounds';
import type { ParcelDescription, ParcelOutlineSource, ParcelRecord, ParcelSource } from './ports';

export interface ParcelsServiceDeps {
  source: ParcelSource;
  /** obrysy dzialek dla obszaru (warstwa granic na mapie) */
  outlines: ParcelOutlineSource;
  now: () => string;
}

const SQUARE_METERS_PER_HECTARE = 10_000;

/** 6 miejsc po przecinku (ok. 10 cm) - tyle, ile niesie geometria; krotsza odpowiedz. */
const roundCoordinate = (value: number): number => Number(value.toFixed(6));

/** Tylko pola opisu - zrodlo moze oddac szerszy rekord, a lista kandydatow nie niesie geometrii. */
function toCandidate(description: ParcelDescription): ParcelCandidate {
  return {
    id: description.id,
    number: description.number,
    region: description.region,
    commune: description.commune,
    county: description.county,
    voivodeship: description.voivodeship,
  };
}

export function createParcelsService({ source, outlines, now }: ParcelsServiceDeps) {
  function toParcel(record: ParcelRecord): Parcel {
    return {
      ...toCandidate(record),
      geometry: record.geometry,
      bbox: boundingBox(record.geometry),
      centroid: centroid(record.geometry),
      // 4 miejsca po przecinku = 1 m2; dalsze cyfry bylyby pozorna precyzja
      areaHa: Math.round(areaSquareMeters(record.geometry)) / SQUARE_METERS_PER_HECTARE,
      source: record.origin,
      fetchedAt: now(),
      // klasouzytki i powierzchnia ewidencyjna sa tylko w rekordzie z WFS ewidencji (ULDK ich nie podaje)
      ...(record.registryAreaHa === undefined ? {} : { registryAreaHa: record.registryAreaHa }),
      ...(record.landUse === undefined ? {} : { landUse: record.landUse }),
    };
  }

  return {
    async get(id: string): Promise<Parcel> {
      const record = await source.byId(id);

      if (!record) throw AppError.notFound('Parcel', id);

      return toParcel(record);
    },

    async at(lng: number, lat: number): Promise<Parcel> {
      const record = await source.byPoint(lng, lat);

      if (!record) throw AppError.notFound('Parcel at', `${lng},${lat}`);

      return toParcel(record);
    },

    /** Obrysy i numery dzialek w kaflu siatki granic (XYZ na poziomie 14 albo 16, domyslnie 16). */
    async boundaries(
      x: number,
      y: number,
      zoom: ParcelBoundaryTileZoom = PARCEL_BOUNDARY_TILE_ZOOM,
    ): Promise<ParcelBoundaries> {
      const found = await outlines.inBounds(tileBounds(zoom, x, y));

      return {
        truncated: found.truncated,
        items: found.items.map((item) => {
          const [lng, lat] = centroid(item.geometry);

          return {
            id: item.id,
            number: item.number,
            geometry: item.geometry,
            center: [roundCoordinate(lng), roundCoordinate(lat)],
          };
        }),
      };
    },

    /** Pelny identyfikator daje najwyzej jedna dzialke; "obreb numer" - liste kandydatow do wyboru przez rolnika. */
    async search(query: string): Promise<ParcelSearchResult> {
      if (PARCEL_ID_PATTERN.test(query)) {
        const record = await source.byId(query);
        const items = record ? [toCandidate(record)] : [];

        return { total: items.length, items };
      }

      const matches = await source.byName(query, PARCEL_LIMITS.candidatesMax);

      return { total: matches.total, items: matches.items.map(toCandidate) };
    },
  };
}

export type ParcelsService = ReturnType<typeof createParcelsService>;
