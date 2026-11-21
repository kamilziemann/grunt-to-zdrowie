import { LocateFixed, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { SelectedParcel } from '../../hooks/use-selected-parcels';
import { useAreaFormatter } from '../parcel-preview';

export interface ParcelListProps {
  items: readonly SelectedParcel[];
  totalAreaHa: number;
  /** naglowek listy; domyslnie "Moje dzialki" */
  title?: string;
  /** brak = lista tylko do odczytu (ekran podsumowania) */
  onShow?: (item: SelectedParcel) => void;
  onRemove?: (id: string) => void;
}

interface ParcelListItemProps {
  item: SelectedParcel;
  onShow?: (item: SelectedParcel) => void;
  onRemove?: (id: string) => void;
}

function ParcelListItem({ item, onShow, onRemove }: ParcelListItemProps) {
  const t = useTranslations('parcels.list');
  const tPreview = useTranslations('parcels.preview');
  const tCommon = useTranslations('common');
  const formatArea = useAreaFormatter();
  const { parcel } = item;
  const number = parcel?.number ?? item.id;
  const show = useCallback(() => onShow?.(item), [onShow, item]);
  const remove = useCallback(() => onRemove?.(item.id), [onRemove, item.id]);

  return (
    <li className="flex min-h-14 items-center gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        {item.state === 'loading' && (
          <Skeleton className="h-9 w-full" aria-label={t('loading', { id: item.id })} />
        )}
        {parcel && (
          <>
            <span className="font-medium">
              {tPreview('parcel', { number: parcel.number })}
              <span className="font-normal text-muted-foreground">
                {' · '}
                {tPreview('areaValue', { area: formatArea(parcel.areaHa) })}
              </span>
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {parcel.region}, {parcel.commune}
            </span>
          </>
        )}
        {(item.state === 'failed' || item.state === 'missing') && (
          <span role="alert" className="text-sm text-destructive">
            {t(item.state, { id: item.id })}
          </span>
        )}
      </div>
      {item.state === 'failed' && (
        <Button variant="outline" size="sm" onClick={item.retry}>
          {tCommon('tryAgain')}
        </Button>
      )}
      {parcel && onShow && (
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t('show', { number })}
          onClick={show}
        >
          <LocateFixed aria-hidden="true" />
        </Button>
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={t('remove', { number })}
          onClick={remove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

/** Lista "moje dzialki" (gospodarstwo): kazda pozycja laduje sie i psuje osobno, suma liczy tylko wczytane. */
export function ParcelList({ items, totalAreaHa, title, onShow, onRemove }: ParcelListProps) {
  const t = useTranslations('parcels.list');
  const formatArea = useAreaFormatter();

  return (
    <section aria-labelledby="parcel-list-title" className="flex flex-col gap-2" data-testid="parcel-list">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="parcel-list-title" className="text-base font-semibold">
          {title ?? t('title')}
        </h2>
        {items.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('count', { count: items.length })}
            {totalAreaHa > 0 ? ` · ${t('totalArea', { area: formatArea(totalAreaHa) })}` : ''}
          </p>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((item) => (
            <ParcelListItem key={item.id} item={item} onShow={onShow} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}
