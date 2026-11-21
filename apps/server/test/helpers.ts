// Pomocniki testow integracyjnych: aplikacja z prawdziwym kontenerem (D1 z miniflare) i opcjonalnymi nadpisaniami
// infrastruktury (np. staly zegar). Kazdy request dostaje ExecutionContext, a test czeka na prace w tle.
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import type { RawServerEnv } from '@app/env/server';

import { createContainer, type ContainerOverrides } from '../src/container';
import { createApp, type App } from '../src/entry/app';
import { createSampleSources } from '../src/infrastructure/sample-sources';
import { createPostgisSurroundingsSource } from '../src/infrastructure/surroundings-postgis';

export function testEnv(extra: Record<string, unknown> = {}): RawServerEnv {
  return { ...env, ...extra };
}

export interface TestApp {
  /** `path` wzgledem http://localhost albo pelny adres (np. host Workera w chmurze). */
  request(path: string, init?: RequestInit): Promise<Response>;
}

/** `extend` dopina trasy testowe (np. straznik `requireAuth()`) do prawdziwej aplikacji, zanim ruszy pierwszy request. */
export function makeApp(
  overrides: ContainerOverrides = {},
  extraEnv: Record<string, unknown> = {},
  extend?: (app: App) => void,
): TestApp {
  // testy nigdy nie wolaja zewnetrznych zrodel analizy: domyslnie atrapy w pamieci, test podmienia pojedyncze zrodla
  const withSources = {
    hydroMapSource: null,
    contextMapSource: null,
    responseStore: null,
    parcelRegistry: null,
    // bez zapisu raportow, zeby testy z roznymi zrodlami nie dostawaly raportu policzonego w innym tescie;
    // test zapisu podaje repozytorium D1 jawnie (test/integration/reports.test.ts)
    reportStore: null,
    ...overrides,
    // otoczenie pola: "brak bazy" (nigdy prawdziwy Neon), test podaje zrodlo w pamieci, gdy go potrzebuje
    analysisSources: {
      ...createSampleSources(),
      surroundings: createPostgisSurroundingsSource({ run: null }),
      ...overrides.analysisSources,
    },
  };
  const app = createApp({ createContainer: (deps) => createContainer(deps, withSources) });

  extend?.(app);

  return {
    async request(path, init) {
      const ctx = createExecutionContext();
      const url = /^https?:\/\//.test(path) ? path : `http://localhost${path}`;
      const response = await app.fetch(new Request(url, init), testEnv(extraEnv), ctx);

      await waitOnExecutionContext(ctx);

      return response;
    },
  };
}

export const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
