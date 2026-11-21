// Zapis raportow w D1 (miniflare z migracjami): analiza zapisuje raport, powtorka wraca z zapisu, GET /reports/:id
// otwiera raport z linku, a raport na dzisiejsza date liczy sie od nowa po dobie.
import { waterReportSchema, type WaterReport } from '@app/contracts';
import { createDb } from '@app/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { MeteoSource } from '../../src/domain/analysis-ports';
import { createSampleSources } from '../../src/infrastructure/sample-sources';
import { createReportsRepository } from '../../src/repositories/reports';
import { referenceParcelSource, REGULAR_FIELD } from '../fixtures/reference-fields';
import { json, makeApp } from '../helpers';

/** Pogoda z atrapy z licznikiem wywolan - powtorka z zapisu nie pyta zrodel. */
function countingMeteo(): MeteoSource & { calls: number } {
  const sample = createSampleSources().meteo;
  const source = {
    calls: 0,
    series: (...args: Parameters<MeteoSource['series']>) => {
      source.calls += 1;

      return sample.series(...args);
    },
  };

  return source;
}

function appAt(now: string, meteo: MeteoSource) {
  return makeApp({
    parcelSource: referenceParcelSource,
    now: () => now,
    reportStore: createReportsRepository(createDb(env.DB)),
    analysisSources: { meteo },
  });
}

describe('zapis raportow', () => {
  it('analiza zapisuje raport; ta sama prosba wraca z zapisu, GET /reports/:id oddaje ten sam raport', async () => {
    const meteo = countingMeteo();
    const app = appAt('2026-11-21T12:00:00.000Z', meteo);
    const body = { field: { parcelIds: [REGULAR_FIELD.id] }, cropId: 'maize_grain', date: '2025-07-20' };
    const first = await (await app.request('/analysis', json(body))).json<WaterReport>();
    const again = await (await app.request('/analysis', json(body))).json<WaterReport>();
    const byId = await app.request(`/reports/${first.meta.reportId}`);
    const stored = await byId.json<WaterReport>();

    expect(meteo.calls).toBe(1);
    expect(first.meta.reused).toBeUndefined();
    expect(again.meta).toMatchObject({
      reportId: first.meta.reportId,
      reused: true,
      generatedAt: first.meta.generatedAt,
    });
    expect(byId.status).toBe(200);
    expect(waterReportSchema.safeParse(stored).error).toBeUndefined();
    expect(stored.assessment).toEqual(first.assessment);
    expect(stored.meta.reused).toBe(true);
  });

  it('zapis usuwa raporty starsze niz 30 dni, mlodsze zostaja', async () => {
    const store = createReportsRepository(createDb(env.DB));
    const report = {} as WaterReport;
    const key = (id: string) => ({
      id,
      fieldId: `parcels:${id}`,
      cropId: 'maize_grain',
      analysisDate: '2026-09-01',
      engineVersion: 'test',
    });

    await store.save(key('r-0000old1'), report, '2026-10-01T12:00:00.000Z');
    await store.save(key('r-0000new1'), report, '2026-10-25T12:00:00.000Z');
    await store.save(key('r-0000now1'), report, '2026-11-21T12:00:00.000Z');

    expect(await store.get('r-0000old1')).toBeNull();
    expect((await store.get('r-0000new1'))?.createdAt).toBe('2026-10-25T12:00:00.000Z');
  });

  it('nieznany raport = 404, zly identyfikator = 400', async () => {
    const app = appAt('2026-11-21T12:00:00.000Z', countingMeteo());

    expect((await app.request('/reports/r-00000000')).status).toBe(404);
    expect((await app.request('/reports/raport-1')).status).toBe(400);
  });

  it('raport policzony w dniu analizy liczy sie od nowa po dobie; inna uprawa to inny raport', async () => {
    const meteo = countingMeteo();
    const body = { field: { parcelIds: [REGULAR_FIELD.id] }, cropId: 'potato', date: '2026-11-21' };
    const at = (now: string, request = body) => appAt(now, meteo).request('/analysis', json(request));

    await at('2026-11-21T08:00:00.000Z');
    await at('2026-11-21T20:00:00.000Z');
    expect(meteo.calls).toBe(1);

    // dobe pozniej: raport z dnia analizy jest nieaktualny (pelniejsza pogoda) - liczony od nowa
    await at('2026-11-22T09:00:00.000Z');
    expect(meteo.calls).toBe(2);

    // ten policzono juz po dniu analizy - sie nie zmienia
    await at('2026-11-25T09:00:00.000Z');
    expect(meteo.calls).toBe(2);

    await at('2026-11-21T21:00:00.000Z', { ...body, cropId: 'sugar_beet' });
    expect(meteo.calls).toBe(3);
  });
});
