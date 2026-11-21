// Adapter EdgeCachePurger na Workers Cache: `cache.purge({ tags })` z `cloudflare:workers`. Czyszczenie dziala
// tylko w entrypoincie, ktory ma cache (domyslny fetch Workera, cron, kolejka) - nie w klasach Workflow.
// Bez Workers Cache w runtime (testy, stary wrangler) adapter loguje pominiecie zamiast rzucac.
import * as workers from 'cloudflare:workers';
import type { Logger } from '@app/logger';

import type { EdgeCachePurger } from '../../domain/edge-cache';

export interface PurgeResult {
  success: boolean;
  errors?: { code: number; message: string }[];
}

export interface WorkersCache {
  purge(options: { tags: string[] }): Promise<PurgeResult>;
}

function runtimeCache(): WorkersCache | undefined {
  const candidate: unknown = (workers as Record<string, unknown>).cache;

  return candidate && typeof (candidate as WorkersCache).purge === 'function'
    ? (candidate as WorkersCache)
    : undefined;
}

export function createEdgeCachePurger(
  logger: Logger,
  cache: WorkersCache | undefined = runtimeCache(),
): EdgeCachePurger {
  return {
    async purge(tags) {
      if (tags.length === 0) return;

      if (!cache) {
        logger.debug('edge cache purge skipped (no Workers Cache in runtime)', { tags });

        return;
      }

      try {
        const result = await cache.purge({ tags: [...tags] });

        if (result.success) logger.info('edge cache purged', { tags });
        else logger.error('edge cache purge failed', { tags, errors: result.errors });
      } catch (error) {
        logger.error('edge cache purge failed', { tags, err: error });
      }
    },
  };
}
