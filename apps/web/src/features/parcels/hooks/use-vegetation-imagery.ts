// Obraz z satelity dla mapy dzialek: jedno zapytanie na wszystkie dzialki z listy i dopiero po wlaczeniu warstwy.
// Zmiana listy przy wlaczonej warstwie czeka chwile (kilka klikniec = jedno zapytanie), a wynik zostaje w cache
// zapytan - powrot do warstwy albo listy, ktora juz byla, nie pyta drugi raz (Copernicus ma limit przy seriach).
import { isRpcError } from '@app/rpc';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { vegetationImageryQuery, type ImageryLayer, type VegetationImagery } from '../api/imagery.queries';
import type { ImageryOverlay } from '../components/parcel-map';
import { imageryDate, todayInPoland } from '../utils/imagery-months';

/** Ile czekamy po zmianie listy dzialek, zanim zapytamy o nowy obraz. */
export const IMAGERY_DEBOUNCE_MS = 700;

/** Warstwa wybrana przez rolnika; `none` = bez obrazu. */
export type ImageryChoice = ImageryLayer | 'none';

/**
 * Stan warstwy dla legendy: `noClearScene` = zima albo chmury przez 30 dni, `notConfigured` = brak kluczy na
 * serwerze, `busy` = limit albo awaria Copernicus (ma sens "sprobuj ponownie"), `failed` = inny blad.
 */
export type ImageryState = 'off' | 'loading' | 'ready' | 'noClearScene' | 'notConfigured' | 'busy' | 'failed';

export interface VegetationImageryView {
  state: ImageryState;
  overlays: readonly ImageryOverlay[];
  data: VegetationImagery | null;
  /** dzien, przed ktorym szukamy zdjecia (RRRR-MM-DD) - do komunikatu o braku czystego zdjecia */
  requestedDate: string;
  retry: () => void;
}

const NO_OVERLAYS: readonly ImageryOverlay[] = [];

function stateOf(error: unknown): ImageryState {
  if (!isRpcError(error)) return 'failed';

  if (error.problem.reason === 'no_clear_scene') return 'noClearScene';

  if (error.code === 'not_configured') return 'notConfigured';

  return error.code === 'rate_limited' || error.code === 'upstream_failed' ? 'busy' : 'failed';
}

/** Wartosc opozniona o `ms` (ostatnia z serii zmian). */
function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);

    return () => window.clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}

export function useVegetationImagery(
  ids: readonly string[],
  choice: ImageryChoice,
  month: string | null,
): VegetationImageryView {
  // kolejnosc na liscie nie zmienia obrazu - posortowane identyfikatory = jeden wpis cache
  const sorted = ids.toSorted().join(',');
  const dzialki = useDebounced(sorted, IMAGERY_DEBOUNCE_MS);
  const today = todayInPoland();
  const date = imageryDate(month, today);
  const layer: ImageryLayer = choice === 'none' ? 'condition' : choice;
  const enabled = choice !== 'none' && dzialki !== '';
  const query = useQuery({ ...vegetationImageryQuery(dzialki, date, layer), enabled });
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);
  const data = enabled ? (query.data ?? null) : null;
  const overlays = useMemo(() => data?.images ?? NO_OVERLAYS, [data]);
  // lista sie zmienila, a opoznienie jeszcze trwa - pokazujemy ladowanie zamiast starego obrazu
  const waiting = choice !== 'none' && ids.length > 0 && sorted !== dzialki;
  const state: ImageryState =
    choice === 'none' || ids.length === 0
      ? 'off'
      : waiting || query.isPending || query.isFetching
        ? 'loading'
        : query.isError
          ? stateOf(query.error)
          : 'ready';

  return {
    state,
    overlays: state === 'ready' ? overlays : NO_OVERLAYS,
    data: state === 'ready' ? data : null,
    requestedDate: date ?? today,
    retry,
  };
}
