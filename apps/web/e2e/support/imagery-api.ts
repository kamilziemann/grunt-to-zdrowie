// Podstawiony obraz z satelity dla e2e: /api/imagery/vegetation pyta ULDK i Copernicus (uslugi zewnetrzne). Obraz
// to maly PNG z gradientem skali kondycji na zasiegu dzialki testowej; blad = Problem Details jak z API.
import type { ProblemCode, VegetationImagery } from '@app/contracts';
import type { Page } from '@playwright/test';

import { PARCEL } from './analysis-api';

const GRADIENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAQklEQVR4nGO4bqB+56il1p0tTnp3FvsY3ZkUanqnMd7yTn6G7Z24Isc7vtUud2xaPe5o9/nckZoRcIdhVMOoBuwaAGcQGJzSsRESAAAAAElFTkSuQmCC';

const BBOX = PARCEL.bbox as [number, number, number, number];

/** Odpowiedz API dla warstwy (zdjecie z 29 maja 2018, jak dla dzialki z dziennika integratora). */
export function imageryResponse(layer: 'condition' | 'moisture', requestedDate: string): VegetationImagery {
  return {
    layer,
    images: [{ image: GRADIENT_PNG, bbox: BBOX }],
    bbox: BBOX,
    requestedDate,
    sceneDate: '2018-05-29',
    sceneCloudCover: 3.2,
    clearShare: 1,
    scale:
      layer === 'condition' ? { low: 0.41, high: 0.83, mean: 0.66 } : { low: -0.05, high: 0.31, mean: 0.14 },
  };
}

export interface ImageryMock {
  /** adresy zapytan (sciezka z query) w kolejnosci */
  requests: string[];
  /** zmiana odpowiedzi w trakcie testu (np. blad, potem sukces po "Sprobuj ponownie") */
  respondWith: (next: ImageryReply) => void;
}

export type ImageryReply =
  | { kind: 'ok' }
  | { kind: 'problem'; status: number; code: ProblemCode; reason?: string };

export async function mockImageryApi(
  page: Page,
  initial: ImageryReply = { kind: 'ok' },
): Promise<ImageryMock> {
  const requests: string[] = [];
  let reply = initial;

  await page.route('**/api/imagery/vegetation**', (route) => {
    const url = new URL(route.request().url());

    requests.push(`${url.pathname}${url.search}`);

    if (reply.kind === 'problem') {
      return route.fulfill({
        status: reply.status,
        contentType: 'application/problem+json',
        json: {
          type: `urn:app:problem:${reply.code}`,
          title: 'Problem',
          status: reply.status,
          code: reply.code,
          ...(reply.reason ? { reason: reply.reason } : {}),
        },
      });
    }

    const layer = url.searchParams.get('warstwa') === 'moisture' ? 'moisture' : 'condition';

    return route.fulfill({ json: imageryResponse(layer, url.searchParams.get('data') ?? '2026-11-22') });
  });

  return {
    requests,
    respondWith: (next) => {
      reply = next;
    },
  };
}
