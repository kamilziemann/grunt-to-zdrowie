// Teksty mapy (opis dla czytnikow ekranu, stany ladowania, podpisy kontrolek) z komunikatow `parcels.map`.
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import type { ParcelMapLabels } from '../components/parcel-map';

export function useMapLabels(variant: 'interactive' | 'static' = 'interactive'): ParcelMapLabels {
  const t = useTranslations('parcels.map');

  return useMemo(
    () => ({
      map: t(variant === 'interactive' ? 'label' : 'staticLabel'),
      loading: t('loading'),
      failed: t('failed'),
      zoomIn: t('zoomIn'),
      zoomOut: t('zoomOut'),
      locate: t('locate'),
      locateUnavailable: t('locateUnavailable'),
      attribution: t('attribution'),
      loadingBoundaries: t('loadingBoundaries'),
      loadingHydro: t('loadingHydro'),
      zoomForBoundaries: t('zoomForBoundaries'),
    }),
    [t, variant],
  );
}
