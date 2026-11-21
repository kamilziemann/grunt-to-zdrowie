// Obraz pola z satelity (GET /api/imagery/vegetation) jako zapytanie TanStack Query: kondycja roslin albo woda
// w roslinach dla wszystkich zaznaczonych dzialek naraz. Zdjecie dla tych samych dzialek, dnia i warstwy sie nie
// zmienia, a kazde pobranie to kilka zapytan do Copernicus (limit przy seriach) - trzymamy je przez sesje strony
// i nie ponawiamy automatycznie (brak czystej sceny albo kluczy to odpowiedz, nie awaria).
import type { ImageryLayer, VegetationImagery } from '@app/contracts';
import { unwrap } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';

const STALE_MS = 30 * 60_000;

export type { ImageryLayer, VegetationImagery };

export const imageryKeys = {
  all: ['imagery'] as const,
  vegetation: (dzialki: string, data: string | undefined, layer: ImageryLayer) =>
    ['imagery', 'vegetation', dzialki, data ?? '', layer] as const,
};

/**
 * GET /imagery/vegetation - obraz dzialek (`dzialki` = identyfikatory po przecinku) z najczystszego zdjecia z 30 dni
 * przed `data` (brak = dzis).
 */
export const vegetationImageryQuery = (dzialki: string, data: string | undefined, layer: ImageryLayer) =>
  queryOptions({
    queryKey: imageryKeys.vegetation(dzialki, data, layer),
    queryFn: ({ signal }): Promise<VegetationImagery> =>
      unwrap<VegetationImagery>(
        getApi().imagery.vegetation.$get(
          { query: { dzialki, warstwa: layer, ...(data ? { data } : {}) } },
          { init: { signal } },
        ),
      ),
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
