// Podstawione odpowiedzi API dla specow analizy i raportu: dzialka (normalnie z ULDK GUGiK) i raport (POST
// /api/analysis liczy z zewnetrznych zrodel). Testy nie wolaja uslug zewnetrznych.
import type { Page } from '@playwright/test';

import { DROUGHT_REPORT } from '../../src/features/report/fixtures/drought-report';
import { LOW_CONFIDENCE_REPORT } from '../../src/features/report/fixtures/low-confidence-report';
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

/** Raport z prawdziwego silnika (susza 15.06.2018, czesci przykladowe w `meta.sampleParts`). */
export const DROUGHT_REPORT_URL = `/raport?dzialki=${PARCEL_ID}&uprawa=winter_wheat&data=${DROUGHT_REPORT.meta.analysisDate}`;

/**
 * Raport z przegladu: "woda w normie" przy niskiej pewnosci (brak gleby), jedna atrapa. Ten sam dzien co susza w
 * starszym raporcie, wiec podstawiamy go pod umowny dzien w adresie.
 */
export const LOW_CONFIDENCE_DATE = '2018-06-16';

export const LOW_CONFIDENCE_REPORT_URL = `/raport?dzialki=${PARCEL_ID}&uprawa=winter_wheat&data=${LOW_CONFIDENCE_DATE}`;

/** Odpowiedz analizy dla daty z zadania: dzien raportu z prawdziwego silnika albo raport przykladowy. */
function reportFor(body: string | null) {
  const date = (JSON.parse(body ?? '{}') as { date?: string }).date;

  if (date === LOW_CONFIDENCE_DATE) return LOW_CONFIDENCE_REPORT;

  return date === DROUGHT_REPORT.meta.analysisDate ? DROUGHT_REPORT : SAMPLE_REPORT;
}

/** Dzialka po identyfikatorze i raport z przykladowymi danymi; `analysisStatus` != 200 = blad z API (Problem Details). */
export async function mockAnalysisApi(
  page: Page,
  { analysisStatus = 200 }: { analysisStatus?: number } = {},
) {
  await page.route('**/api/parcels/by-id**', (route) => route.fulfill({ json: PARCEL }));
  await page.route('**/api/analysis', (route) =>
    analysisStatus === 200
      ? route.fulfill({ json: reportFor(route.request().postData()) })
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
