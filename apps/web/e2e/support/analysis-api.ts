// Podstawione odpowiedzi API dla specow analizy i raportu: dzialka (normalnie z ULDK GUGiK) i raport (POST
// /api/analysis liczy z zewnetrznych zrodel). Testy nie wolaja uslug zewnetrznych.
import type { Page } from '@playwright/test';

import { SAMPLE_REPORT } from '../../src/features/report/fixtures/sample-report';

export const PARCEL_ID = '141201_1.0001.6509';

export const PARCEL = {
  id: PARCEL_ID,
  number: '6509',
  region: 'Mińsk Mazowiecki',
  commune: 'Mińsk Mazowiecki',
  county: 'miński',
  voivodeship: 'mazowieckie',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.589876, 52.17167],
        [21.590427, 52.172262],
        [21.589704, 52.172208],
        [21.589876, 52.17167],
      ],
    ],
  },
  bbox: [21.589332, 52.17167, 21.590427, 52.172275],
  centroid: [21.5899, 52.172],
  areaHa: 0.2658,
  source: 'uldk',
  fetchedAt: '2026-06-15T08:00:00.000Z',
};

export const REPORT_URL = `/raport?dzialki=${PARCEL_ID}&uprawa=winter_wheat&data=2026-06-15`;

/** Dzialka po identyfikatorze i raport z przykladowymi danymi; `analysisStatus` != 200 = blad z API (Problem Details). */
export async function mockAnalysisApi(
  page: Page,
  { analysisStatus = 200 }: { analysisStatus?: number } = {},
) {
  await page.route('**/api/parcels/by-id**', (route) => route.fulfill({ json: PARCEL }));
  await page.route('**/api/analysis', (route) =>
    analysisStatus === 200
      ? route.fulfill({ json: SAMPLE_REPORT })
      : route.fulfill({
          status: analysisStatus,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://errors.app/upstream_failed',
            title: 'Upstream failed',
            status: analysisStatus,
            code: 'upstream_failed',
          }),
        }),
  );
}
