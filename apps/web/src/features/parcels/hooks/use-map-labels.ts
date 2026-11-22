// Teksty mapy (opis dla czytnikow ekranu, stany ladowania, podpisy kontrolek) z komunikatow `parcels.map`.
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import type { ContextKindLabels } from '@/lib/context-map';

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
      loadingContext: t('loadingContext'),
      zoomForBoundaries: t('zoomForBoundaries'),
    }),
    [t, variant],
  );
}

const CONTEXT_KINDS = [
  'weir',
  'dam',
  'lock',
  'spring',
  'intake',
  'natura2000',
  'landscape_park',
  'national_park',
  'nature_reserve',
] as const;

/** Podpisy na mapie otoczenia pola: rodzaj budowli ("jaz") i rodzaj obszaru chronionego. */
export function useContextKindLabels(): ContextKindLabels {
  const t = useTranslations('parcels.map.contextKinds');

  return useMemo(() => Object.fromEntries(CONTEXT_KINDS.map((kind) => [kind, t(kind)])), [t]);
}
