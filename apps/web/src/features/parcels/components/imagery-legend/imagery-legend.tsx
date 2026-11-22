import type { ImageryLayer } from '@app/contracts';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

import type { VegetationImagery } from '../../api/imagery.queries';
import type { ImageryState } from '../../hooks/use-vegetation-imagery';

/** Paski skali rysowane tymi samymi tokenami co kolory PNG z API (`--vegetation-*`, `--moisture-*`). */
export const IMAGERY_GRADIENTS: Record<ImageryLayer, string> = {
  condition: 'from-(--vegetation-low) via-(--vegetation-mid) to-(--vegetation-high)',
  moisture: 'from-(--moisture-low) via-(--moisture-mid) to-(--moisture-high)',
};

const ENDS: Record<ImageryLayer, readonly ['worse' | 'dry', 'better' | 'wet']> = {
  condition: ['worse', 'better'],
  moisture: ['dry', 'wet'],
};

/** Ponizej tej czesci pola bez chmur mowimy, ze czesc pola nie ma koloru. */
const CLEAR_ENOUGH = 0.9;

export interface ImageryLegendProps {
  layer: ImageryLayer;
  state: ImageryState;
  data: VegetationImagery | null;
  /** dzien, przed ktorym szukano zdjecia (komunikat o braku czystego zdjecia) */
  requestedDate: string;
  onRetry: () => void;
  /** otwarta od poczatku; domyslnie zwinieta (jeden wiersz), zeby nie zaslaniala mapy */
  defaultOpen?: boolean;
  className?: string;
  /** wspolna nazwa grupy legend (atrybut `name`): naraz rozwinieta jest tylko jedna legenda z grupy */
  group?: string;
}

/**
 * Legenda obrazu z satelity: pasek skali opisany slowami ("slabiej - lepiej", "sucho - wilgotno"), dzien zdjecia
 * i drobnym drukiem ograniczenia (wielkosc kwadratu, jeden dzien, wilgotnosc roslin a nie gleby, skala wzgledna).
 * Stan pobierania i bledy z "Sprobuj ponownie" sa widoczne takze w zwinietej legendzie.
 */
export function ImageryLegend({
  layer,
  state,
  data,
  requestedDate,
  onRetry,
  defaultOpen = false,
  className,
  group,
}: ImageryLegendProps) {
  const t = useTranslations('parcels.imagery');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const day = (iso: string) => format.dateTime(new Date(`${iso}T12:00:00Z`), { dateStyle: 'long' });
  const value = (number: number) => format.number(number, { maximumFractionDigits: 2 });
  const [start, end] = ENDS[layer];
  const note =
    state === 'loading'
      ? t('status.loading')
      : state === 'noClearScene'
        ? t('status.noClearScene', { date: day(requestedDate) })
        : state === 'notConfigured' || state === 'busy' || state === 'failed'
          ? t(`status.${state}`)
          : null;

  return (
    <section
      aria-label={t(`legend.${layer}`)}
      className={cn('w-72 max-w-full rounded-lg border bg-card text-card-foreground shadow-md', className)}
      data-testid="imagery-legend"
      data-imagery-state={state}
    >
      <details open={defaultOpen} name={group} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-1.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 truncate">{t(`legend.${layer}`)}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('h-2 w-10 rounded-full bg-linear-to-r', IMAGERY_GRADIENTS[layer])}
            />
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-open:rotate-180"
            />
          </span>
        </summary>
        <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs">
          <div
            className={cn('h-2.5 rounded-full bg-linear-to-r', IMAGERY_GRADIENTS[layer])}
            aria-hidden="true"
          />
          <p className="flex justify-between font-medium text-muted-foreground">
            <span>{t(`legend.${start}`)}</span>
            <span>{t(`legend.${end}`)}</span>
          </p>
          {data && (
            <p className="text-sm text-foreground">{t('legend.scene', { date: day(data.sceneDate) })}</p>
          )}
          {data && data.clearShare < CLEAR_ENOUGH && (
            <p className="text-muted-foreground">{t('legend.clouds')}</p>
          )}
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[0.6875rem] leading-snug text-muted-foreground">
            <li>{t('legend.limits.pixel')}</li>
            <li>{t('legend.limits.oneDay')}</li>
            {layer === 'moisture' && <li>{t('legend.limits.plantsNotSoil')}</li>}
            <li>{t('legend.limits.relative')}</li>
          </ul>
          {data && (
            <p className="text-[0.6875rem] leading-snug text-muted-foreground">
              {t(`legend.advisor.${layer}`, { low: value(data.scale.low), high: value(data.scale.high) })}
            </p>
          )}
        </div>
      </details>
      {note && (
        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm">
          <output className="flex items-start gap-2">
            {state === 'loading' && (
              <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
            )}
            {note}
          </output>
          {(state === 'busy' || state === 'failed') && (
            <Button variant="outline" size="sm" className="min-h-11 self-start" onClick={onRetry}>
              {tCommon('tryAgain')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
