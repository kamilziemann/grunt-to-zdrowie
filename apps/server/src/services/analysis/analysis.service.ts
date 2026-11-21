// Orkiestrator analizy wodnej: pole -> dane ze zrodel (rownolegle, kazde z limitem czasu) -> etapy obliczen ->
// raport. Zrodlo, ktore milczy albo sie spoznia, nie przerywa analizy: raport dostaje status `missing`, ograniczenie
// i nizsza pewnosc. Brak danych komunikujemy wprost. Serwis nie zna HTTP ani konkretnych dostawcow danych.
import {
  ANALYSIS_LIMITS,
  type AnalysisRequest,
  type FieldArea,
  type LimitationId,
  type Parcel,
  type SourceId,
  type SourceRef,
  type WaterReport,
} from '@app/contracts';
import { AppError } from '@app/http';

import { fieldFromGeometry, fieldFromParcels, shortHash } from '../../domain/field-area';
import { addDays, addYears, isoDateInPoland } from '../../domain/iso-date';
import type { AnalysisStages, DataSources, ParcelLookup, Sourced, StageInput } from './ports';
import { failureNote } from '../../lib/source-note';

/** Wersja silnika wchodzi do identyfikatora raportu: zmiana obliczen = nowy raport dla tych samych danych. */
export const ANALYSIS_ENGINE_VERSION = '0.2.0';

/**
 * Limity czasu zrodel (ms) - razem z obliczeniami mieszcza sie w 30 s na analize. Meteo ma najdluzszy, bo bez
 * niego nie ma oceny: NASA POWER oddaje 10 lat zwykle w ok. 2 s, ale pod obciazeniem bywa wolniejszy.
 */
export const SOURCE_TIMEOUTS_MS: Record<Exclude<SourceId, 'parcel'>, number> = {
  meteo: 12_000,
  forecast: 6000,
  // SoilGrids: 18 malych pokryc WCS w puli po 4 - zwykle ok. 1-1,5 s
  soil: 8000,
  terrain: 4000,
  hydro: 5000,
  vegetation: 10_000,
};

/** Zapas dni przed 10-letnim oknem: bilans potrzebuje rozbiegu, a pierwszy okres zaczyna sie 60 dni wczesniej. */
const WARMUP_DAYS = 120;
const FORECAST_DAYS = 7;
const BOUNDARIES_STALE_DAYS = 365;

const MISSING_LIMITATION: Partial<Record<SourceId, LimitationId>> = {
  meteo: 'meteo_missing',
  forecast: 'forecast_missing',
  soil: 'soil_missing',
  terrain: 'terrain_missing',
  hydro: 'hydro_missing',
  vegetation: 'vegetation_missing',
};

const PARCEL_PROVIDERS: Record<Parcel['source'], string> = {
  uldk: 'GUGiK ULDK',
  'egib-wfs': 'GUGiK EGiB (WFS)',
};

export interface AnalysisServiceDeps {
  parcels: ParcelLookup;
  sources: DataSources;
  stages: AnalysisStages;
  /** chwila biezaca (ISO 8601) - testy podaja staly zegar */
  now: () => string;
  timeoutsMs?: Partial<typeof SOURCE_TIMEOUTS_MS>;
}

/** Nazwy zrodel w notatkach dla czlowieka. */
const SOURCE_NAMES: Record<SourceId, string> = {
  parcel: 'ewidencja gruntów',
  meteo: 'pogoda',
  forecast: 'prognoza',
  soil: 'gleba',
  terrain: 'teren',
  hydro: 'woda w otoczeniu',
  vegetation: 'zdjęcia satelitarne',
};

/** Zrodlo z limitem czasu: spoznienie i nieoczekiwany blad staja sie odpowiedzia `missing` z powodem. */
async function settle<T>(
  id: SourceId,
  request: () => Promise<Sourced<T>>,
  timeoutMs: number,
): Promise<Sourced<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const missing = (note: string): Sourced<T> => ({
    data: null,
    source: { id, provider: SOURCE_NAMES[id], status: 'missing', sample: false, note },
  });
  const timeout = new Promise<Sourced<T>>((resolve) => {
    timer = setTimeout(
      () =>
        resolve(
          missing(`brak odpowiedzi w ${String(timeoutMs / 1000).replace('.', ',')} s (limit czasu analizy)`),
        ),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([request(), timeout]);
  } catch (error) {
    return missing(failureNote(SOURCE_NAMES[id], error));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function createAnalysisService({
  parcels,
  sources,
  stages,
  now,
  timeoutsMs = {},
}: AnalysisServiceDeps) {
  const limits = { ...SOURCE_TIMEOUTS_MS, ...timeoutsMs };

  function assertDateInRange(date: string, today: string): void {
    const earliest = addYears(today, -ANALYSIS_LIMITS.historyYears);

    if (date > today) {
      throw AppError.validation([{ path: 'date', message: 'Analysis date cannot be in the future' }]);
    }

    if (date < earliest) {
      throw AppError.validation([
        { path: 'date', message: `Analysis date cannot be earlier than ${earliest} (last 10 years)` },
      ]);
    }
  }

  async function resolveField(
    input: AnalysisRequest['field'],
  ): Promise<{ field: FieldArea; source: SourceRef }> {
    if ('geometry' in input) {
      return {
        field: fieldFromGeometry(input),
        source: {
          id: 'parcel',
          provider: 'obszar wskazany na mapie (geometria od użytkownika)',
          status: 'ok',
          sample: false,
          fetchedAt: now(),
        },
      };
    }

    const found = await Promise.all([...new Set(input.parcelIds)].map((id) => parcels.get(id)));
    const [first] = found;

    return {
      field: fieldFromParcels(found),
      source: {
        id: 'parcel',
        provider: first ? PARCEL_PROVIDERS[first.source] : 'GUGiK',
        status: 'ok',
        sample: false,
        ...(first ? { fetchedAt: first.fetchedAt } : {}),
      },
    };
  }

  return {
    async analyze(request: AnalysisRequest): Promise<WaterReport> {
      const started = Date.now();
      const today = isoDateInPoland(now());
      const { date, cropId } = request;

      assertDateInRange(date, today);

      const { field, source: parcelSource } = await resolveField(request.field);
      const from = addDays(addYears(date, -ANALYSIS_LIMITS.historyYears), -WARMUP_DAYS);
      const [meteo, forecast, soil, terrain, hydro, vegetation] = await Promise.all([
        settle('meteo', () => sources.meteo.series(field.centroid, from, date), limits.meteo),
        // prognoza ma sens tylko dla analizy "na dzis"; dla dat historycznych nie udajemy, ze ja znamy
        date === today
          ? settle(
              'forecast',
              () => sources.forecast.forecast(field.centroid, date, FORECAST_DAYS),
              limits.forecast,
            )
          : null,
        settle('soil', () => sources.soil.profile(field), limits.soil),
        settle('terrain', () => sources.terrain.terrain(field), limits.terrain),
        settle('hydro', () => sources.hydro.context(field), limits.hydro),
        settle('vegetation', () => sources.vegetation.series(field, date), limits.vegetation),
      ]);

      const crop = stages.crop(cropId, date);
      const fetched = [meteo, forecast, soil, terrain, hydro, vegetation].flatMap((item) =>
        item ? [item.source] : [],
      );
      const input: StageInput = {
        field,
        cropId,
        date,
        crop,
        meteo: meteo.data,
        forecast: forecast?.data ?? null,
        soil: soil.data,
        terrain: terrain.data,
        hydro: hydro.data,
        vegetation: vegetation.data,
        sampleSources: fetched.filter((source) => source.sample).map((source) => source.id),
      };
      const assessment = stages.assess(input);
      const history = stages.history(input);
      const causes = stages.causes(input, assessment, history);
      const zones = stages.zones(input);
      const reportSources = [parcelSource, ...fetched];
      const missing = fetched.filter((source) => source.status === 'missing');
      const limitations = new Set<LimitationId>(stages.limitations(input, assessment));

      for (const source of missing) {
        const limitation = MISSING_LIMITATION[source.id];

        if (limitation) limitations.add(limitation);
      }

      if (reportSources.some((source) => source.sample)) limitations.add('sample_data');

      // granice dzialek i hydrografia sa biezace - dla dawnej daty to wspolczesne przyblizenie
      if (date < addDays(today, -BOUNDARIES_STALE_DAYS)) limitations.add('current_boundaries');

      return {
        meta: {
          reportId: `r-${shortHash([field.id, cropId, date, ANALYSIS_ENGINE_VERSION].join('|'))}`,
          engineVersion: ANALYSIS_ENGINE_VERSION,
          analysisDate: date,
          generatedAt: now(),
          durationMs: Date.now() - started,
          // bez pogody nie ma bilansu, wiec nie ma oceny; pozostale braki (takze luki w zrodle) tylko ja oslabiaja
          status:
            meteo.data === null
              ? 'insufficient'
              : fetched.some((source) => source.status !== 'ok')
                ? 'partial'
                : 'complete',
          sample: reportSources.some((source) => source.sample),
          sampleParts: [...stages.sampleParts],
        },
        field,
        crop,
        assessment,
        history,
        causes,
        recommendations: stages.recommend(input, assessment, causes, zones),
        zones,
        sources: reportSources,
        limitations: [...limitations],
      };
    },
  };
}

export type AnalysisService = ReturnType<typeof createAnalysisService>;
