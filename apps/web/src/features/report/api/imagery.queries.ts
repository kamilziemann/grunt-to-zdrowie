// Obrazy pola z satelity dla raportu (GET /api/imagery/vegetation): kondycja roslin i woda w roslinach z dnia
// analizy. Klucz zapytania ten sam co na mapie dzialek (`features/parcels`), wiec obraz pobrany tam nie pyta drugi
// raz - Copernicus ma limit przy seriach. Feature "parcels" nie wystawia swojego zapytania w `index.ts`, stad ta
// para (do polaczenia, gdy wystawi). Brak czystego zdjecia albo kluczy to odpowiedz, nie awaria: bez ponawiania.
import type { ImageryLayer, VegetationImagery } from '@app/contracts';
import { isRpcError, unwrap } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';

const STALE_MS = 30 * 60_000;

export type { ImageryLayer, VegetationImagery };

/**
 * GET /imagery/vegetation - obraz dzialek (`dzialki` = identyfikatory po przecinku, posortowane) z najczystszego
 * zdjecia z 30 dni przed `data`.
 */
export const reportImageryQuery = (dzialki: string, data: string, layer: ImageryLayer) =>
  queryOptions({
    queryKey: ['imagery', 'vegetation', dzialki, data, layer] as const,
    queryFn: ({ signal }): Promise<VegetationImagery> =>
      unwrap<VegetationImagery>(
        getApi().imagery.vegetation.$get({ query: { dzialki, warstwa: layer, data } }, { init: { signal } }),
      ),
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });

/**
 * Stan obrazu slowami: `noClearScene` = chmury albo snieg przez 30 dni, `notConfigured` = brak kluczy na serwerze,
 * `busy` = limit albo awaria Copernicus (ma sens "sprobuj ponownie"), `failed` = inny blad.
 */
export type ImageryProblem = 'noClearScene' | 'notConfigured' | 'busy' | 'failed';

export function imageryProblem(error: unknown): ImageryProblem {
  if (!isRpcError(error)) return 'failed';

  if (error.problem.reason === 'no_clear_scene') return 'noClearScene';

  if (error.code === 'not_configured') return 'notConfigured';

  return error.code === 'rate_limited' || error.code === 'upstream_failed' ? 'busy' : 'failed';
}
