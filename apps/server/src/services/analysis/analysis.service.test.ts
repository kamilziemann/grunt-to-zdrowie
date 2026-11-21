import { waterReportSchema, type AnalysisRequest } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import {
  emptyOutlineSource,
  referenceParcelSource,
  REGULAR_FIELD,
} from '../../../test/fixtures/reference-fields';
import { engineStages } from '../../domain/engine-stages';
import { sampleStages } from '../../domain/sample-stages';
import { createSampleSources } from '../../infrastructure/sample-sources';
import { createParcelsService } from '../parcels';
import { createAnalysisService, type AnalysisServiceDeps } from './analysis.service';
import type { DataSources } from './ports';

const NOW = '2026-11-21T12:00:00.000Z';
const now = () => NOW;

function service(sources: Partial<DataSources> = {}, extra: Partial<AnalysisServiceDeps> = {}) {
  return createAnalysisService({
    parcels: createParcelsService({ source: referenceParcelSource, outlines: emptyOutlineSource, now }),
    sources: { ...createSampleSources(), ...sources },
    stages: sampleStages,
    now,
    ...extra,
  });
}

const request = (date: string, overrides: Partial<AnalysisRequest> = {}): AnalysisRequest => ({
  field: { parcelIds: [REGULAR_FIELD.id] },
  cropId: 'maize_grain',
  date,
  ...overrides,
});

describe('analysis service', () => {
  it('sklada raport zgodny z kontraktem, oznaczony jako przykladowy', async () => {
    const report = await service().analyze(request('2026-07-20'));

    expect(waterReportSchema.safeParse(report).error).toBeUndefined();
    expect(report.meta).toMatchObject({ analysisDate: '2026-07-20', status: 'complete', sample: true });
    expect(report.field).toMatchObject({ kind: 'parcel', parcelIds: [REGULAR_FIELD.id] });
    expect(report.field.areaHa).toBeCloseTo(5, 1);
    expect(report.crop).toMatchObject({ cropId: 'maize_grain', stage: 'mid', iungGroup: 'maize_grain' });
    expect(report.assessment.climaticBalance).toMatchObject({ periodNo: 7, periodTo: '2026-07-20' });
    expect(report.history.seasons).toHaveLength(10);
    expect(report.limitations).toContain('sample_data');
    expect(report.sources.map((source) => source.id)).toEqual([
      'parcel',
      'meteo',
      'soil',
      'terrain',
      'hydro',
      'vegetation',
    ]);
  });

  it('wlasciwe etapy: ocena i historia z danych, raport mowi, ktore czesci i zrodla sa przykladowe', async () => {
    const report = await service({}, { stages: engineStages }).analyze(request('2026-07-20'));

    expect(waterReportSchema.safeParse(report).error).toBeUndefined();
    expect(report.meta.sampleParts).toEqual(['zones']);
    expect(report.assessment.climaticBalance).toMatchObject({ method: 'iung_dg95', periodNo: 7 });
    expect(report.assessment.climaticBalance?.categoryScenarios).toHaveLength(4);
    expect(report.assessment.rootZone?.seasonEtDeficitMm).toBeGreaterThanOrEqual(0);
    expect(report.history.seasons).toHaveLength(10);
    // atrapy gleby i pogody nie pozwalaja na wysoka pewnosc
    expect(report.assessment.confidence).toBe('low');
  });

  it('ten sam wniosek daje ten sam identyfikator raportu, inna uprawa - inny', async () => {
    const analysis = service();
    const first = await analysis.analyze(request('2026-07-20'));
    const again = await analysis.analyze(request('2026-07-20'));
    const other = await analysis.analyze(request('2026-07-20', { cropId: 'potato' }));

    expect(again.meta.reportId).toBe(first.meta.reportId);
    expect(other.meta.reportId).not.toBe(first.meta.reportId);
  });

  it('prognoze pobiera tylko dla analizy na dzis', async () => {
    const today = await service().analyze(request('2026-11-21'));
    const past = await service().analyze(request('2026-07-20'));

    expect(today.sources.map((source) => source.id)).toContain('forecast');
    expect(past.sources.map((source) => source.id)).not.toContain('forecast');
  });

  it('zrodlo, ktore milczy, pada albo sie spoznia, daje raport czesciowy z ograniczeniami', async () => {
    const report = await service(
      {
        soil: { profile: () => Promise.reject(new Error('soil service down')) },
        terrain: { terrain: () => new Promise(() => undefined) },
        hydro: {
          context: () =>
            Promise.resolve({
              data: null,
              source: {
                id: 'hydro',
                provider: 'test',
                status: 'missing',
                sample: false,
                note: 'no coverage',
              },
            }),
        },
      },
      { timeoutsMs: { terrain: 20 } },
    ).analyze(request('2026-07-20'));
    const byId = Object.fromEntries(report.sources.map((source) => [source.id, source]));

    expect(waterReportSchema.safeParse(report).error).toBeUndefined();
    expect(report.meta.status).toBe('partial');
    expect(byId.soil).toMatchObject({
      status: 'missing',
      note: 'gleba: błąd połączenia (soil service down)',
    });
    expect(byId.terrain).toMatchObject({
      status: 'missing',
      note: 'brak odpowiedzi w 0,02 s (limit czasu analizy)',
    });
    expect(byId.hydro).toMatchObject({ status: 'missing', note: 'no coverage' });
    expect(report.limitations).toEqual(
      expect.arrayContaining(['soil_missing', 'terrain_missing', 'hydro_missing']),
    );
    expect(report.assessment.rootZone).toBeNull();
    expect(report.assessment.confidence).toBe('low');
  });

  it('luki w zrodle (status partial) robia raport czesciowym, choc ocena jest policzona', async () => {
    const sample = createSampleSources();
    const report = await service({
      meteo: {
        series: async (point, from, to) => {
          const full = await sample.meteo.series(point, from, to);

          return { ...full, source: { ...full.source, status: 'partial', note: '3 days without data' } };
        },
      },
    }).analyze(request('2026-07-20'));

    expect(report.meta.status).toBe('partial');
    expect(report.assessment.level).not.toBe('unknown');
  });

  it('bez pogody nie ma oceny: status insufficient, poziom unknown, zadnych zalecen', async () => {
    const report = await service({
      meteo: {
        series: () =>
          Promise.resolve({
            data: null,
            source: { id: 'meteo', provider: 'test', status: 'missing', sample: false },
          }),
      },
    }).analyze(request('2026-07-20'));

    expect(report.meta.status).toBe('insufficient');
    expect(report.assessment).toMatchObject({ level: 'unknown', climaticBalance: null });
    expect(report.causes).toEqual([]);
    expect(report.recommendations).toMatchObject({ retention: [], agrotech: [], irrigation: null });
    expect(report.limitations).toContain('meteo_missing');
  });

  it('poza sezonem mowi, ze progi suszy nie obowiazuja, i nie wymysla zalecen', async () => {
    const report = await service().analyze(request('2026-01-15'));

    expect(report.assessment.level).toBe('out_of_season');
    expect(report.assessment.climaticBalance).toMatchObject({ status: 'out_of_season', periodNo: null });
    expect(report.causes).toEqual([]);
    expect(report.limitations).toContain('out_of_season');
  });

  it('dla dat sprzed archiwum satelitarnego raport dziala bez satelity i zaznacza dawne granice', async () => {
    const report = await service().analyze(request('2016-12-01'));

    expect(report.assessment.vegetation).toBeNull();
    expect(report.limitations).toEqual(expect.arrayContaining(['vegetation_missing', 'current_boundaries']));
  });

  it('odrzuca date z przyszlosci i starsza niz 10 lat', async () => {
    await expect(service().analyze(request('2026-11-22'))).rejects.toMatchObject({
      code: 'validation_failed',
      issues: [expect.objectContaining({ path: 'date' })],
    });
    await expect(service().analyze(request('2016-11-20'))).rejects.toMatchObject({
      code: 'validation_failed',
    });
    await expect(service().analyze(request('2016-11-21'))).resolves.toBeDefined();
  });

  it('nieznana dzialka = not_found, a powtorzony identyfikator liczy sie raz', async () => {
    await expect(
      service().analyze(request('2026-07-20', { field: { parcelIds: ['999999_9.9999.1'] } })),
    ).rejects.toMatchObject({ code: 'not_found' });

    const report = await service().analyze(
      request('2026-07-20', { field: { parcelIds: [REGULAR_FIELD.id, REGULAR_FIELD.id] } }),
    );

    expect(report.field.kind).toBe('parcel');
  });
});
