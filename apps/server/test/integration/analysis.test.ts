// POST /analysis od zadania do raportu dla trzech pol wzorcowych (dzialki w pamieci zamiast ULDK, dane przykladowe
// zamiast zrodel zewnetrznych): zgodnosc z kontraktem, walidacja wejscia, 404 i brak cache dla odpowiedzi.
import { waterReportSchema, type WaterReport } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { SoilSource } from '../../src/domain/analysis-ports';
import { createSampleSources } from '../../src/infrastructure/sample-sources';
import {
  NARROW_FIELD,
  REFERENCE_FIELDS,
  referenceParcelSource,
  URBAN_FIELD,
} from '../fixtures/reference-fields';
import { json, makeApp } from '../helpers';

const app = makeApp({ parcelSource: referenceParcelSource, now: () => '2026-11-21T12:00:00.000Z' });

async function analyze(body: unknown): Promise<{ status: number; report: WaterReport }> {
  const res = await app.request('/analysis', json(body));

  return { status: res.status, report: await res.json<WaterReport>() };
}

describe('POST /analysis', () => {
  it.each(REFERENCE_FIELDS.map((field) => [field.number, field.id] as const))(
    'pole wzorcowe %s daje raport zgodny z kontraktem',
    async (_number, id) => {
      const { status, report } = await analyze({
        field: { parcelIds: [id] },
        cropId: 'winter_wheat',
        date: '2026-06-30',
      });

      expect(status).toBe(200);
      expect(waterReportSchema.safeParse(report).error).toBeUndefined();
      expect(report.meta.sample).toBe(true);
      expect(report.field.parcelIds).toEqual([id]);
      expect(report.assessment.climaticBalance?.periodNo).toBe(5);
    },
  );

  it('waski pas dostaje profil podluzny, mala dzialka - zwykle strefy', async () => {
    const narrow = await analyze({
      field: { parcelIds: [NARROW_FIELD.id] },
      cropId: 'potato',
      date: '2026-07-20',
    });
    const urban = await analyze({
      field: { parcelIds: [URBAN_FIELD.id] },
      cropId: 'potato',
      date: '2026-07-20',
    });

    expect(narrow.report.field.areaHa).toBeCloseTo(9, 0);
    expect(narrow.report.zones?.layout).toBe('profile');
    expect(urban.report.field.areaHa).toBeCloseTo(0.1, 2);
    expect(urban.report.zones?.layout).toBe('zones');
  });

  it('kilka dzialek to jedno pole, a wlasna geometria to pole narysowane', async () => {
    const [first, second] = REFERENCE_FIELDS;
    const farm = await analyze({
      field: { parcelIds: [first?.id, second?.id] },
      cropId: 'grassland',
      date: '2026-06-30',
    });
    const drawn = await analyze({
      field: { geometry: first?.geometry, label: 'Pole za stodołą' },
      cropId: 'grassland',
      date: '2026-06-30',
    });

    expect(farm.report.field).toMatchObject({ kind: 'parcels' });
    expect(farm.report.field.areaHa).toBeCloseTo(14, 0);
    expect(drawn.report.field).toMatchObject({ kind: 'drawn', label: 'Pole za stodołą', parcelIds: [] });
    // uzytki zielone nie maja progow suszy IUNG
    expect(drawn.report.assessment.climaticBalance?.status).toBe('not_monitored');
    expect(drawn.report.limitations).toContain('crop_not_monitored');
  });

  it('zle wejscie = 400, nieznana dzialka = 404, odpowiedz nie trafia do wspolnego cache', async () => {
    const valid = { field: { parcelIds: [URBAN_FIELD.id] }, cropId: 'potato', date: '2026-07-20' };
    const statuses = [
      await app.request('/analysis', json({ ...valid, cropId: 'bananas' })),
      await app.request('/analysis', json({ ...valid, date: '20.07.2026' })),
      await app.request('/analysis', json({ ...valid, date: '2027-01-01' })),
      await app.request('/analysis', json({ ...valid, field: { parcelIds: [] } })),
      await app.request('/analysis', json({ ...valid, field: { parcelIds: ['141201_1.0001.1'] } })),
    ].map((res) => res.status);
    const ok = await app.request('/analysis', json(valid));

    expect(statuses).toEqual([400, 400, 400, 400, 404]);
    expect(ok.headers.get('cache-control')).toContain('no-store');
  });

  it('gleba missing w suchym okresie: bilans na glebie sredniej, poziom ostrzega zamiast "w normie"', async () => {
    const sample = createSampleSources();
    // dzialka przy zabudowie: SoilGrids nie ma predykcji ani w polu, ani w 2 km
    const soil: SoilSource = {
      profile: () =>
        Promise.resolve({
          data: null,
          source: {
            id: 'soil',
            provider: 'SoilGrids',
            status: 'missing',
            sample: false,
            note: 'brak predykcji',
          },
        }),
    };
    // wiosna 2018 bez deszczu: KBW okresu konczacego sie 10 czerwca gleboko ujemny
    const meteo: typeof sample.meteo = {
      async series(point, from, to) {
        const result = await sample.meteo.series(point, from, to);
        const days = (result.data?.days ?? []).map((day) =>
          day.date >= '2018-04-01' && day.date <= '2018-06-15'
            ? Object.assign(day, { precipMm: 0, et0Mm: 4.5 })
            : day,
        );

        return { ...result, data: result.data && { ...result.data, days } };
      },
    };
    const dry = makeApp({
      parcelSource: referenceParcelSource,
      now: () => '2026-11-21T12:00:00.000Z',
      analysisSources: { soil, meteo },
    });
    const res = await dry.request(
      '/analysis',
      json({ field: { parcelIds: [URBAN_FIELD.id] }, cropId: 'winter_wheat', date: '2018-06-15' }),
    );
    const report = await res.json<WaterReport>();
    const scenarios = report.assessment.climaticBalance?.categoryScenarios ?? [];

    expect(waterReportSchema.safeParse(report).error).toBeUndefined();
    expect(scenarios.some((scenario) => scenario.belowThreshold)).toBe(true);
    expect(['watch', 'risk', 'drought']).toContain(report.assessment.level);
    expect(report.assessment).toMatchObject({ soilBasis: 'assumed_medium', confidence: 'low' });
    expect(report.assessment.rootZone).not.toBeNull();
    expect(report.limitations).toContain('soil_missing');
  });
});
