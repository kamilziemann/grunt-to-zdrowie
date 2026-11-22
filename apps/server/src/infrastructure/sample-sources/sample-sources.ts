// Dane PRZYKLADOWE dla silnika analizy: deterministyczne (te same dla tego samego miejsca i daty), o realistycznym
// przebiegu sezonowym, ale NIE pochodza z zadnego pomiaru. Kazde zrodlo oznacza sie `sample: true`, a raport
// niesie wtedy `meta.sample` i ograniczenie `sample_data`. Sluza do budowy i testow reszty systemu, zanim powstana
// prawdziwe adaptery (pakiety P1, P3-P6 planu silnika analizy) - te je zastepuja w container.ts.
import type { FieldArea, SourceId, SourceRef } from '@app/contracts';

import type {
  DailyWeather,
  DataSources,
  ForecastSeries,
  HydroContext,
  LngLat,
  MeteoSeries,
  SoilProfile,
  Sourced,
  TerrainData,
  VegetationSeries,
} from '../../domain/analysis-ports';
import { addDays, dayOfYear, daysBetween, withYear, yearOf } from '../../domain/iso-date';

const PROVIDER = 'Dane przykładowe (atrapa)';
const FIRST_SATELLITE_YEAR = 2017;
const BASELINE_YEARS = 5;

/** Liczba z przedzialu [0, 1) zalezna tylko od pary liczb calkowitych - bez stanu, wiec powtarzalna. */
function unit(a: number, b: number): number {
  let hash = Math.imul(a ^ 0x9e_37_79_b9, 0x85_eb_ca_6b) ^ Math.imul(b + 0x7f_4a_7c_15, 0xc2_b2_ae_35);

  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c_1b_3c_6d);
  hash ^= hash >>> 12;
  hash = Math.imul(hash, 0x29_7a_2d_39);
  hash ^= hash >>> 15;

  return (hash >>> 0) / 4_294_967_296;
}

function seedOf([lng, lat]: LngLat): number {
  return Math.round(lng * 100) * 10_007 + Math.round(lat * 100);
}

function sourced<T>(id: SourceId, data: T, extra: Partial<SourceRef> = {}): Sourced<T> {
  return { data, source: { id, provider: PROVIDER, status: 'ok', sample: true, ...extra } };
}

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** Pogoda dnia: sezonowa temperatura i parowanie, opad losowy z "suchymi" i "mokrymi" latami. */
function weatherOn(seed: number, date: string): DailyWeather {
  const day = daysBetween('2000-01-01', date);
  const doy = dayOfYear(date);
  const season = Math.sin((2 * Math.PI * (doy - 110)) / 365);
  const tMean = 8.5 + 10.5 * season + (unit(seed, day) - 0.5) * 6;
  const growing = Math.max(0, Math.sin((Math.PI * (doy - 60)) / 245));
  const yearFactor = 0.6 + 0.7 * unit(seed, yearOf(date));
  const wet = unit(seed + 1, day) < 0.33;
  const precip = wet ? -Math.log(1 - unit(seed + 2, day)) * 5 * yearFactor : 0;

  return {
    date,
    precipMm: round(precip),
    tMinC: round(tMean - 5),
    tMaxC: round(tMean + 5),
    tMeanC: round(tMean),
    et0Mm: round(0.3 + 3.7 * growing * (0.85 + 0.3 * unit(seed + 3, day))),
  };
}

function ndviOn(seed: number, date: string): number {
  const doy = dayOfYear(date);
  const canopy = Math.max(0, Math.sin((Math.PI * (doy - 85)) / 200));
  const dryYear = 0.7 * unit(seed, yearOf(date));

  return round(0.18 + 0.62 * canopy * (1 - 0.25 * dryYear), 2);
}

function observation(seed: number, date: string, field: FieldArea) {
  const ndvi = ndviOn(seed, date);

  return {
    date,
    ndvi,
    ndmi: round(ndvi * 0.55 - 0.12, 2),
    validShare: round(0.75 + 0.2 * unit(seed + 4, dayOfYear(date)), 2),
    pixels: Math.max(1, Math.round(field.areaHa * 100)),
  };
}

export function createSampleSources(): DataSources {
  return {
    meteo: {
      series(point, from, to): Promise<Sourced<MeteoSeries>> {
        const seed = seedOf(point);
        const days = Array.from({ length: Math.max(0, daysBetween(from, to) + 1) }, (_unused, index) =>
          weatherOn(seed, addDays(from, index)),
        );

        return Promise.resolve(
          sourced('meteo', { days, gridKm: 50 }, { dataFrom: from, dataTo: to, resolution: 'ok. 50 km' }),
        );
      },
    },

    forecast: {
      forecast(point, from, days): Promise<Sourced<ForecastSeries>> {
        const seed = seedOf(point);
        const series = Array.from({ length: days }, (_unused, index) => {
          const { date, precipMm, et0Mm, tMinC, tMaxC } = weatherOn(seed, addDays(from, index + 1));

          return { date, precipMm, et0Mm, tMinC, tMaxC };
        });

        return Promise.resolve(sourced('forecast', { days: series }, { dataFrom: from }));
      },
    },

    soil: {
      profile(field): Promise<Sourced<SoilProfile>> {
        // piasek gliniasty: 60% piasku, 15% ilu, 2% materii organicznej -> 103 mm/m wg Saxtona-Rawlsa
        const sandier = unit(seedOf(field.centroid), 7) < 0.5;

        return Promise.resolve(
          sourced(
            'soil',
            {
              sandPct: sandier ? 72 : 60,
              siltPct: sandier ? 20 : 25,
              clayPct: sandier ? 8 : 15,
              organicMatterPct: sandier ? 1.4 : 2,
              fieldCapacity: sandier ? 0.165 : 0.208,
              wiltingPoint: sandier ? 0.075 : 0.105,
              availableWaterMmPerM: sandier ? 90 : 103,
              category: sandier ? 1 : 2,
              basis: 'texture',
            },
            { resolution: '250 m' },
          ),
        );
      },
    },

    terrain: {
      terrain(field): Promise<Sourced<TerrainData>> {
        const seed = seedOf(field.centroid);
        const slope = round(1 + 6 * unit(seed, 11));
        const size = 20;
        const cellSizeM = 10;
        // rowna pochylnia opadajaca na poludnie - wystarcza do testow ksztaltu danych
        const elevationM = Array.from({ length: size * size }, (_unused, index) =>
          round(120 + (Math.floor(index / size) * cellSizeM * slope) / 100, 2),
        );

        return Promise.resolve(
          sourced(
            'terrain',
            {
              grid: {
                crs: 'sample:local',
                originX: 0,
                originY: 0,
                cellSizeM,
                cols: size,
                rows: size,
                elevationM,
              },
              summary: {
                elevationMinM: Math.min(...elevationM),
                elevationMaxM: Math.max(...elevationM),
                slopeMeanPct: slope,
                slopeShareAbove5Pct: slope > 5 ? 0.6 : 0.1,
                depressions: unit(seed, 12) < 0.4 ? 1 : 0,
              },
            },
            { resolution: '10 m' },
          ),
        );
      },
    },

    hydro: {
      context(field): Promise<Sourced<HydroContext>> {
        const seed = seedOf(field.centroid);
        const [west, south, east] = field.bbox;
        const ditchM = Math.round(30 + 400 * unit(seed, 21));

        return Promise.resolve(
          sourced('hydro', {
            searchRadiusM: 500,
            nearestWatercourseM: unit(seed, 22) < 0.5 ? Math.round(150 + 350 * unit(seed, 23)) : null,
            nearestDitchM: ditchM,
            waterBodies: unit(seed, 24) < 0.3 ? 1 : 0,
            wetlands: 0,
            // row wzdluz poludniowej granicy pola
            features: [
              {
                kind: 'ditch',
                coordinates: [
                  [west, south - ditchM / 111_000],
                  [east, south - ditchM / 111_000],
                ],
              },
            ],
            treeCoverShare: round(0.12 * unit(seed, 25), 2),
          }),
        );
      },
    },

    vegetation: {
      series(field, date): Promise<Sourced<VegetationSeries>> {
        const seed = seedOf(field.centroid);
        const year = yearOf(date);

        if (year < FIRST_SATELLITE_YEAR) {
          return Promise.resolve({
            data: null,
            source: {
              id: 'vegetation',
              provider: PROVIDER,
              status: 'missing',
              sample: true,
              note: 'archiwum zdjęć Sentinel-2 zaczyna się w 2017 r.',
            },
          });
        }

        const observations = [3, 8, 13].map((back) => observation(seed, addDays(date, -back), field));
        const years = Array.from({ length: BASELINE_YEARS }, (_unused, index) => year - 1 - index).filter(
          (candidate) => candidate >= FIRST_SATELLITE_YEAR,
        );
        const baseline = years.map((candidate) =>
          Object.assign(observation(seed, withYear(date, candidate), field), { year: candidate }),
        );

        return Promise.resolve(
          sourced(
            'vegetation',
            { observations, baseline, cellSizeM: 10 },
            { dataTo: date, resolution: '10 m' },
          ),
        );
      },
    },
  };
}
