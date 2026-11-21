import { ArrowLeft, Hourglass, MapPinned } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

import { useMapLabels } from '../../hooks/use-map-labels';
import { useSelectedParcels } from '../../hooks/use-selected-parcels';
import { ParcelList } from '../parcel-list';
import { ParcelMap, type MapFocus } from '../parcel-map';

export interface AnalysisSummaryProps {
  ids: readonly string[];
  /** powrot do mapy z ta sama lista dzialek */
  backHref: AppHref;
}

/**
 * Krok po wyborze dzialek: podsumowanie tego, co pojdzie do analizy wodnej. Wybor uprawy i daty oraz sama analiza
 * to nastepny etap prac - ekran mowi o tym wprost i nie pokazuje zadnych wynikow.
 */
export function AnalysisSummary({ ids, backHref }: AnalysisSummaryProps) {
  const t = useTranslations('parcels');
  const mapLabels = useMapLabels('static');
  const selected = useSelectedParcels(ids);
  const focus = useMemo((): MapFocus | null => {
    const [first, ...rest] = selected.parcels;

    if (!first || !selected.settled) return null;

    const bbox = rest.reduce<MapFocus['bbox']>(
      (box, parcel) => [
        Math.min(box[0], parcel.bbox[0]),
        Math.min(box[1], parcel.bbox[1]),
        Math.max(box[2], parcel.bbox[2]),
        Math.max(box[3], parcel.bbox[3]),
      ],
      first.bbox,
    );

    return { bbox, key: `summary:${ids.join(',')}` };
  }, [ids, selected.parcels, selected.settled]);

  if (ids.length === 0) {
    return (
      <EmptyState
        titleAs="h1"
        icon={MapPinned}
        title={t('summary.emptyTitle')}
        description={t('summary.emptyDescription')}
      >
        <Button asChild size="xl">
          <Link href={backHref}>{t('summary.back')}</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <PageHeader title={t('summary.title')} description={t('summary.description')}>
        <Button asChild variant="outline" size="xl">
          <Link href={backHref}>
            <ArrowLeft aria-hidden="true" />
            {t('summary.change')}
          </Link>
        </Button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <ParcelList items={selected.items} totalAreaHa={selected.totalAreaHa} title={t('summary.parcels')} />
        <div className="h-72 overflow-hidden rounded-xl border lg:h-full lg:min-h-80">
          <ParcelMap selected={selected.parcels} focus={focus} interactive={false} labels={mapLabels} />
        </div>
      </div>
      <Alert>
        <Hourglass aria-hidden="true" />
        <AlertTitle>{t('summary.nextTitle')}</AlertTitle>
        <AlertDescription>{t('summary.nextDescription')}</AlertDescription>
      </Alert>
    </div>
  );
}
