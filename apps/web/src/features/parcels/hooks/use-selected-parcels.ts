// Dzialki z listy "moje dzialki": identyfikatory zyja w adresie strony, a geometrie i opis dociagamy z API
// (kazda dzialka to osobne zapytanie - jedna awaria nie zabiera calej listy).
import type { Parcel } from '@app/contracts';
import { useQueries } from '@tanstack/react-query';

import { parcelQuery } from '../api/parcels.queries';

export type SelectedParcelState = 'loading' | 'ready' | 'missing' | 'failed';

export interface SelectedParcel {
  id: string;
  state: SelectedParcelState;
  parcel: Parcel | null;
  retry: () => void;
}

export interface SelectedParcels {
  items: SelectedParcel[];
  /** tylko wczytane dzialki (do mapy i sumy powierzchni) */
  parcels: Parcel[];
  totalAreaHa: number;
  /** wszystkie zapytania zakonczone (udane albo nie) */
  settled: boolean;
}

export function useSelectedParcels(ids: readonly string[]): SelectedParcels {
  return useQueries({
    queries: ids.map((id) => parcelQuery(id)),
    combine: (results): SelectedParcels => {
      const items = results.map((result, index): SelectedParcel => {
        const state: SelectedParcelState = result.isPending
          ? 'loading'
          : result.isError
            ? 'failed'
            : result.data
              ? 'ready'
              : 'missing';

        return {
          id: ids[index] ?? '',
          state,
          parcel: result.data ?? null,
          retry: () => {
            void result.refetch();
          },
        };
      });
      const parcels = items.flatMap((item) => (item.parcel ? [item.parcel] : []));

      return {
        items,
        parcels,
        totalAreaHa: parcels.reduce((sum, parcel) => sum + parcel.areaHa, 0),
        settled: items.every((item) => item.state !== 'loading'),
      };
    },
  });
}
