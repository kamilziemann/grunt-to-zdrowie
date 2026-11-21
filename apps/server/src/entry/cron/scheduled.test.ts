// Cron: kazdy krok jest izolowany - blad jednego nie zatrzymuje nastepnych, a tagi zmienionych danych trafiaja do
// jednego purge na koniec ticka.
import type { ScheduledController } from '@cloudflare/workers-types';
import { testEnv } from '../../../test/helpers';
import { describe, expect, it } from 'vitest';

import type { Container } from '../../services/container';
import { createScheduledHandler, type CronStep } from './scheduled';

const controller: ScheduledController = { cron: '*/10 * * * *', scheduledTime: 0, noRetry() {} };
const ctx = { waitUntil: () => {} };

function setup(steps: CronStep[]) {
  const purged: string[][] = [];
  const container = {
    edgeCache: {
      purge: async (tags: readonly string[]) => {
        purged.push([...tags]);
      },
    },
  } as unknown as Container;

  return { purged, handler: createScheduledHandler(() => container, steps) };
}

describe('scheduled', () => {
  it('runs every step even when one fails and purges collected tags once', async () => {
    const called: string[] = [];
    const { purged, handler } = setup([
      {
        name: 'a',
        failure: 'a failed',
        run: async () => {
          called.push('a');

          throw new Error('boom');
        },
      },
      {
        name: 'b',
        failure: 'b failed',
        run: async () => {
          called.push('b');

          return ['parcels'];
        },
      },
    ]);

    await handler(controller, testEnv(), ctx);

    expect(called).toEqual(['a', 'b']);
    expect(purged).toEqual([['parcels']]);
  });

  it('skips purge when nothing changed', async () => {
    const { purged, handler } = setup([{ name: 'a', failure: 'x', run: async () => {} }]);

    await handler(controller, testEnv(), ctx);

    expect(purged).toEqual([]);
  });
});
