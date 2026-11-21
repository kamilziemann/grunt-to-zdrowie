import type { ParcelGeometry } from '@app/contracts';
import { ArrowLeft, MapPinned, PencilRuler } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { geometryAreaHa, outerRing, ringBbox } from '@/lib/field-geometry';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

import { useMapLabels } from '../../hooks/use-map-labels';
import { useSelectedParcels } from '../../hooks/use-selected-parcels';
import { ParcelList } from '../parcel-list';
import { ParcelMap, type MapFocus, type MapParcel } from '../parcel-map';
import { useAreaFormatter } from '../parcel-preview';

export interface AnalysisSummaryProps {
  ids: readonly string[];
  /** powrot do mapy z ta sama lista dzialek */
  backHref: AppHref;
  /** wlasny obszar (D3) - analizowany zamiast calych dzialek; dzialki zostaja na mapie jako tlo */
  area?: { geometry: ParcelGeometry; kind: 'part' | 'drawn' } | null;
}

/**
 * Krok po wyborze dzialek: podsumowanie tego, co pojdzie do analizy wodnej (lista i mapa). Wybor uprawy i daty
 * dokleja pod nim formularz z feature "analysis" (trasa `/analiza`).
 */
export function AnalysisSummary({ ids, backHref, area = null }: AnalysisSummaryProps) {
  const t = useTranslations('parcels');
  const formatArea = useAreaFormatter();
  const mapLabels = useMapLabels('static');
  const selected = useSelectedParcels(ids);
  const areaParcel = useMemo(
    (): MapParcel | null => (area ? { id: 'own-area', number: '', geometry: area.geometry } : null),
    [area],
  );
  const mapSelected = useMemo(
    () => (areaParcel ? [areaParcel] : selected.parcels),
    [areaParcel, selected.parcels],
  );
  const focus = useMemo((): MapFocus | null => {
    const ring = area ? outerRing(area.geometry) : null;

    if (ring) return { bbox: ringBbox(ring), key: `area:${ring.length}:${ring[0]?.join(',') ?? ''}` };

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
  }, [area, ids, selected.parcels, selected.settled]);

  if (ids.length === 0 && !area) {
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
        <div className="flex flex-col gap-4">
          {area && (
            <section
              aria-labelledby="own-area-title"
              className="flex items-start gap-3 rounded-xl border-2 border-primary/50 bg-card p-4"
              data-testid="own-area"
            >
              <PencilRuler aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-0.5">
                <h2 id="own-area-title" className="text-lg font-semibold">
                  {t('field.summaryTitle')}
                  <span className="font-normal text-muted-foreground">
                    {' · '}
                    {t('field.summaryArea', { area: formatArea(geometryAreaHa(area.geometry)) })}
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {area.kind === 'part' && selected.parcels.length > 0
                    ? t('field.summaryPart', {
                        numbers: selected.parcels.map((parcel) => parcel.number).join(', '),
                      })
                    : t('field.summaryDrawn')}
                </p>
              </div>
            </section>
          )}
          {ids.length > 0 && (
            <ParcelList
              items={selected.items}
              totalAreaHa={selected.totalAreaHa}
              title={t('summary.parcels')}
            />
          )}
        </div>
        <div className="h-72 overflow-hidden rounded-xl border lg:h-full lg:min-h-80">
          <ParcelMap
            selected={mapSelected}
            preview={areaParcel ? (selected.parcels[0] ?? null) : null}
            focus={focus}
            interactive={false}
            labels={mapLabels}
          />
        </div>
      </div>
    </div>
  );
}
