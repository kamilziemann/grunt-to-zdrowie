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

import {
  fieldFromGeometry,
  fieldFromParcels,
  geometryFieldId,
  parcelsFieldId,
  shortHash,
} from '../../domain/field-area';
import { withCauseShares } from '../../domain/causes';
import { drainedLowland } from '../../domain/drained-lowland';
import { withHotDays } from '../../domain/hot-days';
import { addDays, addYears, isoDateInPoland } from '../../domain/iso-date';
import { landCoverGuess, summarizeLandUse } from '../../domain/land-use';
import { reconcileSoilWithRegistry } from '../../domain/soil-registry';
import { waterOutlook } from '../../domain/water-outlook';
import type {
  AnalysisStages,
  DataSources,
  ParcelLookup,
  ParcelRegistry,
  ParcelRegistryEntry,
  ReportKey,
  ReportStore,
  Sourced,
  StageInput,
} from './ports';
import { failureNote } from '../../lib/source-note';

/** Wersja silnika wchodzi do identyfikatora raportu: zmiana obliczen = nowy raport dla tych samych danych. */
export const ANALYSIS_ENGINE_VERSION = '0.8.5';

/**
 * Limity czasu zrodel (ms) - razem z obliczeniami mieszcza sie w 30 s na analize. Meteo ma najdluzszy, bo bez
 * niego nie ma oceny: NASA POWER oddaje 10 lat zwykle w ok. 2 s, ale pod obciazeniem bywa wolniejszy.
 */
export const SOURCE_TIMEOUTS_MS: Record<Exclude<SourceId, 'parcel'>, number> = {
  meteo: 12_000,
  forecast: 6000,
  // SoilGrids: 18 malych pokryc WCS w puli po 4 - zwykle ok. 1-1,5 s
  soil: 8000,
  // kafle wysokosci: 1-4 PNG po ok. 40 KB rownolegle, potem obliczenia na siatce do 60 tys. komorek
  terrain: 8000,
  hydro: 5000,
  vegetation: 10_000,
};

/**
 * Klasouzytki z WFS ewidencji (ULDK ich nie podaje) pobieramy rownolegle ze zrodlami danych; limit krotszy niz
 * zrodla, zeby nie wydluzal analizy - spozniona ewidencja to raport bez opisu uzytku.
 */
export const REGISTRY_TIMEOUT_MS = 6000;

/**
 * Otoczenie pola (drzewa, budowle wodne, obszary chronione) to argumenty do zalecen, nie podstawa oceny: brak tych
 * danych nie obniza statusu raportu ani pewnosci, a zrodlo pokazuje sie z powodem w `sources`.
 */
export const SURROUNDINGS_TIMEOUT_MS = 5000;

/** Zapas dni przed 10-letnim oknem: bilans potrzebuje rozbiegu, a pierwszy okres zaczyna sie 60 dni wczesniej. */
const WARMUP_DAYS = 120;
const FORECAST_DAYS = 7;
const BOUNDARIES_STALE_DAYS = 365;
/** raport policzony w dniu analizy liczymy od nowa po dobie (nowa pogoda, prognoza, zdjecia) */
const TODAY_REPORT_TTL_MS = 24 * 60 * 60 * 1000;
/** raport czesciowy (ktores zrodlo nie odpowiedzialo) wraca z zapisu najwyzej tyle - potem liczymy od nowa */
const PARTIAL_REPORT_TTL_MS = 60 * 60 * 1000;

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

/**
 * Jak zrodlo trafia do analizy: BDOT10k (hydrografia i otoczenie pola, id `hydro`) jest zaimportowany wczesniej do
 * PostGIS, reszta pobierana przy analizie. Zrodlo bez daty pobrania dostaje chwile analizy.
 */
function withMode(source: SourceRef, at: string): SourceRef {
  return {
    ...source,
    mode: source.id === 'hydro' ? 'preloaded' : 'live',
    ...(source.fetchedAt === undefined && source.status !== 'missing' ? { fetchedAt: at } : {}),
  };
}

/** Jedno zdanie do zrodla dzialki, gdy granice pochodza z przeterminowanej pamieci (GUGiK nie odpowiedzial). */
function staleParcelNote(fetchedAt: string): string {
  return `Granice działki z zapisu z ${fetchedAt.slice(0, 10)}: GUGiK nie odpowiedział, więc mogły się od tego czasu zmienić.`;
}

export interface AnalysisServiceDeps {
  parcels: ParcelLookup;
  sources: DataSources;
  stages: AnalysisStages;
  /** ewidencja (klasouzytki, powierzchnia ewidencyjna) dla dzialek z ULDK; brak = raport bez opisu uzytku */
  registry?: ParcelRegistry;
  registryTimeoutMs?: number;
  /** zapis raportow; brak = kazda analiza liczona od nowa, `GET /reports/:id` odpowiada 404 */
  reports?: ReportStore;
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
  name = SOURCE_NAMES[id],
): Promise<Sourced<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const missing = (note: string): Sourced<T> => ({
    data: null,
    source: { id, provider: name, status: 'missing', sample: false, note },
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
    return missing(failureNote(name, error));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Ewidencja z limitem czasu; blad albo spoznienie = brak danych (raport bez opisu uzytku, analiza idzie dalej). */
async function registryWithin(
  lookup: () => Promise<(ParcelRegistryEntry | null)[]>,
  timeoutMs: number,
): Promise<(ParcelRegistryEntry | null)[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null[]>((resolve) => {
    timer = setTimeout(() => resolve([]), timeoutMs);
  });

  try {
    return await Promise.race([lookup(), timeout]);
  } catch {
    return [];
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Pole uzupelnione o ewidencje dzialek, ktorych zrodlo (ULDK) jej nie podalo. */
function withRegistry(field: FieldArea, parcels: readonly Parcel[], entries: (ParcelRegistryEntry | null)[]) {
  const complete = parcels.map((parcel, index) => {
    const entry = entries[index];

    return parcel.landUse || !entry
      ? parcel
      : {
          ...parcel,
          landUse: entry.landUse,
          ...(entry.registryAreaHa === undefined ? {} : { registryAreaHa: entry.registryAreaHa }),
        };
  });
  const enriched = fieldFromParcels(complete);

  return {
    ...field,
    ...(enriched.landUse ? { landUse: enriched.landUse } : {}),
    ...(enriched.registryAreaHa === undefined ? {} : { registryAreaHa: enriched.registryAreaHa }),
  };
}

export function createAnalysisService({
  parcels,
  sources,
  stages,
  registry,
  registryTimeoutMs = REGISTRY_TIMEOUT_MS,
  reports,
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
  ): Promise<{ field: FieldArea; source: SourceRef; parcels: Parcel[] }> {
    if ('geometry' in input) {
      return {
        parcels: [],
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
    const stale = found.find((parcel) => parcel.stale);

    return {
      parcels: found,
      field: fieldFromParcels(found),
      source: {
        id: 'parcel',
        provider: first ? PARCEL_PROVIDERS[first.source] : 'GUGiK',
        status: 'ok',
        sample: false,
        ...(first ? { fetchedAt: first.fetchedAt } : {}),
        ...(stale ? { note: staleParcelNote(stale.fetchedAt) } : {}),
      },
    };
  }

  /** Klucz raportu z samego zadania - bez pobierania dzialek, zeby powtorka odpowiadala od razu. */
  function keyOf(request: AnalysisRequest): ReportKey {
    const fieldId =
      'geometry' in request.field
        ? geometryFieldId(request.field.geometry)
        : parcelsFieldId(request.field.parcelIds);
    const parts = [fieldId, request.cropId, request.date, ANALYSIS_ENGINE_VERSION];

    return {
      id: `r-${shortHash(parts.join('|'))}`,
      fieldId,
      cropId: request.cropId,
      analysisDate: request.date,
      engineVersion: ANALYSIS_ENGINE_VERSION,
    };
  }

  const sameKey = (a: ReportKey, b: ReportKey): boolean =>
    a.id === b.id &&
    a.fieldId === b.fieldId &&
    a.cropId === b.cropId &&
    a.analysisDate === b.analysisDate &&
    a.engineVersion === b.engineVersion;

  /**
   * Zapisany raport dla tego klucza, jesli wolno go uzyc. Raport policzony w dniu analizy (raport "na dzis": ostatnie
   * dni pogody, prognoza, nowe zdjecia) jest wazny dobe; raport policzony pozniej niz data analizy sie nie zmienia.
   * Blad odczytu = brak zapisu (liczymy od nowa).
   */
  async function stored(key: ReportKey): Promise<WaterReport | null> {
    const found = await reports?.get(key.id).catch(() => null);

    if (!found || !sameKey(found.key, key)) return null;

    const computedOnTheDay = isoDateInPoland(found.createdAt) <= key.analysisDate;
    const age = Date.parse(now()) - Date.parse(found.createdAt);

    const { status } = found.report.meta;

    // zrodlo chwilowo milczalo: raport bez oceny (brak pogody) liczymy od nowa przy kazdym wejsciu, czesciowy -
    // po godzinie; inaczej chwilowa awaria dostawcy zostawalaby w zapisie jako "brak oceny" na dobe
    if (status === 'insufficient') return null;

    if (status === 'partial' && age > PARTIAL_REPORT_TTL_MS) return null;

    return computedOnTheDay && age > TODAY_REPORT_TTL_MS ? null : found.report;
  }

  return {
    /** Zapisany raport po identyfikatorze; brak = 404. */
    async report(id: string): Promise<WaterReport> {
      const found = await reports?.get(id);

      if (!found) throw AppError.notFound('Report', id);

      return { ...found.report, meta: { ...found.report.meta, reused: true } };
    },

    /** Raport dla pola, uprawy i daty: z zapisu, gdy ten sam byl juz liczony, inaczej liczony od nowa i zapisany. */
    async analyze(request: AnalysisRequest): Promise<WaterReport> {
      const started = Date.now();
      const today = isoDateInPoland(now());
      const { date, cropId } = request;

      assertDateInRange(date, today);

      const key = keyOf(request);
      const previous = await stored(key);

      if (previous) return { ...previous, meta: { ...previous.meta, reused: true } };

      const ids = 'geometry' in request.field ? [] : [...new Set(request.field.parcelIds)];
      // ewidencja rusza razem z ULDK; dzialka z zapasowego WFS ma ja w rekordzie, wtedy wynik ponizej jest pomijany
      const registryLookup =
        registry && ids.length > 0
          ? registryWithin(() => Promise.all(ids.map((id) => registry.byId(id))), registryTimeoutMs)
          : Promise.resolve([]);
      const { field: resolved, source: parcelSource, parcels: found } = await resolveField(request.field);
      const from = addDays(addYears(date, -ANALYSIS_LIMITS.historyYears), -WARMUP_DAYS);
      const surroundingsSource = sources.surroundings;
      const [entries, meteo, forecast, soil, terrain, hydro, vegetation, surroundings] = await Promise.all([
        found.every((parcel) => parcel.landUse) ? Promise.resolve([]) : registryLookup,
        settle('meteo', () => sources.meteo.series(resolved.centroid, from, date), limits.meteo),
        // prognoza ma sens tylko dla analizy "na dzis"; dla dat historycznych nie udajemy, ze ja znamy
        date === today
          ? settle(
              'forecast',
              () => sources.forecast.forecast(resolved.centroid, date, FORECAST_DAYS),
              limits.forecast,
            )
          : null,
        settle('soil', () => sources.soil.profile(resolved), limits.soil),
        settle('terrain', () => sources.terrain.terrain(resolved), limits.terrain),
        settle('hydro', () => sources.hydro.context(resolved), limits.hydro),
        settle('vegetation', () => sources.vegetation.series(resolved, date), limits.vegetation),
        surroundingsSource
          ? settle(
              'hydro',
              () => surroundingsSource.surroundings(resolved),
              SURROUNDINGS_TIMEOUT_MS,
              'otoczenie pola',
            )
          : null,
      ]);
      const field = found.length > 0 ? withRegistry(resolved, found, entries) : resolved;
      const landUse = summarizeLandUse(field.landUse, cropId, field.registryAreaHa);

      const crop = stages.crop(cropId, date);
      const fetched = [meteo, forecast, soil, terrain, hydro, vegetation].flatMap((item) =>
        item ? [item.source] : [],
      );
      // gleba z modelu uzgodniona z klasa bonitacyjna z ewidencji (wyrazna sprzecznosc = gleba wg ewidencji)
      const reconciled = soil.data ? reconcileSoilWithRegistry(soil.data, field.landUse) : null;
      const input: StageInput = {
        field,
        cropId,
        date,
        crop,
        meteo: meteo.data,
        forecast: forecast?.data ?? null,
        soil: reconciled?.soil ?? null,
        terrain: terrain.data,
        hydro: hydro.data,
        vegetation: vegetation.data,
        surroundings: surroundings?.data ?? null,
        sampleSources: fetched.filter((source) => source.sample).map((source) => source.id),
      };
      const assessed = stages.assess(input);
      const history = stages.history(input);
      // dni upalne tylko objasniaja (upal jest juz w ET0): dowody przy przyczynie albo w ocenie, poziom bez zmian;
      // pogoda z atrapy nie jest dowodem
      const { assessment, causes: explained } = withHotDays(
        input.sampleSources?.includes('meteo') ? undefined : input.meteo?.days,
        date,
        assessed,
        stages.causes(input, assessed, history),
      );
      const causes = withCauseShares(explained);
      const zones = stages.zones(input);
      const generatedAt = now();
      const reportSources = [parcelSource, ...fetched, ...(surroundings ? [surroundings.source] : [])].map(
        (source) => withMode(source, generatedAt),
      );
      const missing = fetched.filter((source) => source.status === 'missing');
      const limitations = new Set<LimitationId>(stages.limitations(input, assessment));

      for (const source of missing) {
        const limitation = MISSING_LIMITATION[source.id];

        if (limitation) limitations.add(limitation);
      }

      if (reportSources.some((source) => source.sample)) limitations.add('sample_data');

      const recommendations = stages.recommend(input, assessment, causes, zones);

      // BDOT10k nie zna zastawek ani przepustow - przy zaleceniu zastawki raport mowi wprost, czego nie wiemy
      if (recommendations.retention.some((item) => item.measure === 'ditch_weir'))
        limitations.add('drainage_structures_unknown');

      // granice dzialek i hydrografia sa biezace - dla dawnej daty to wspolczesne przyblizenie
      if (date < addDays(today, -BOUNDARIES_STALE_DAYS)) limitations.add('current_boundaries');

      // dzialka bez uzytku z ewidencji (WFS EGiB nie odpowiedzial albo go nie zna): nie wiemy, czy to pole uprawne
      if (field.parcelIds.length > 0 && (!field.landUse || field.landUse.length === 0)) {
        limitations.add('land_use_unknown');

        const guess = landCoverGuess(field.landUse, {
          woodedAreaShare: input.surroundings?.trees.woodedAreaShare,
          soilSubstituted: input.soil?.substituteDistanceM !== undefined,
        });

        if (guess) limitations.add(guess === 'forest' ? 'likely_forest' : 'likely_not_farmland');
      }

      if (reconciled?.conflict) {
        limitations.add(
          reconciled.conflict.direction === 'lighter'
            ? 'soil_lighter_by_registry'
            : 'soil_heavier_by_registry',
        );
      }

      // satelita porownany z poprzednimi latami - nie wiemy, co wtedy roslo na polu
      if ((assessment.vegetation?.baselineYears ?? 0) > 0) limitations.add('vegetation_rotation_unknown');

      const report: WaterReport = {
        meta: {
          reportId: key.id,
          engineVersion: ANALYSIS_ENGINE_VERSION,
          analysisDate: date,
          generatedAt,
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
        ...(landUse ? { landUse } : {}),
        ...(input.surroundings
          ? { surroundings: { ...input.surroundings, drainedLowland: drainedLowland(input).detected } }
          : {}),
        crop,
        assessment,
        history,
        causes,
        recommendations,
        zones,
        sources: reportSources,
        limitations: [...limitations],
        ...waterOutlook(input, forecast?.source ?? null),
      };

      // zapis nie moze zepsuc odpowiedzi: raport bez zapisu jest nadal poprawny, policzy sie przy powtorce
      await reports?.save(key, report, now()).catch(() => undefined);

      return report;
    },
  };
}

export type AnalysisService = ReturnType<typeof createAnalysisService>;
