// Handler `scheduled()` (Cron Trigger, wrangler.jsonc -> triggers.crons): buduje kontener z env i wola kroki po
// kolei. Logika jest w serwisach, nie tutaj; blad jednego kroku nie zatrzymuje nastepnych. Dzis jest jeden krok
// (heartbeat w logu); kolejne dopisuje sie do STEPS.
import type { ScheduledController } from '@cloudflare/workers-types';
import type { RawServerEnv } from '@app/env/server';
import type { Logger } from '@app/logger';

import type { Container, ContainerFactory } from '../../services/container';
import { resolveServerVars, rootLoggerFor } from '../middlewares';

export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface CronStep {
  /** nazwa kroku w logu */
  name: string;
  /** komunikat ostrzezenia, gdy krok sie nie uda */
  failure: string;
  /** tagi cache brzegowego danych, ktore krok zmienil (pusta lista = nic publicznego) */
  run(container: Container, logger: Logger): Promise<readonly string[] | void>;
}

/** Kroki ticka w kolejnosci; kazdy osobno: blad jednego nie zatrzymuje nastepnych. */
export const STEPS: readonly CronStep[] = [
  {
    name: 'heartbeat',
    failure: 'heartbeat failed',
    run: async (_container, logger) => {
      logger.info('cron heartbeat');
    },
  },
];

export function createScheduledHandler(
  createContainer: ContainerFactory,
  steps: readonly CronStep[] = STEPS,
) {
  return async (controller: ScheduledController, env: RawServerEnv, ctx: WaitUntilContext): Promise<void> => {
    const vars = resolveServerVars(env);
    const logger = rootLoggerFor(env).child({ entry: 'cron', cron: controller.cron });
    const container = createContainer({ env, vars, logger, waitUntil: (promise) => ctx.waitUntil(promise) });
    const changed = new Set<string>();

    for (const step of steps) {
      try {
        for (const tag of (await step.run(container, logger)) ?? []) changed.add(tag);
      } catch (error) {
        logger.warn(step.failure, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (changed.size > 0) await container.edgeCache.purge([...changed]);
  };
}
