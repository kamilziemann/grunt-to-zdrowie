import { ChevronDown } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import type { HydroStatus } from '../parcel-map';

/** Probki legendy rysowane tymi samymi tokenami co warstwa na mapie (`--map-*`). */
const SWATCHES = [
  { key: 'ditch', className: 'h-0.5 bg-(--map-ditch)' },
  { key: 'stream', className: 'h-1.5 rounded-full bg-(--map-stream)' },
  {
    key: 'canal',
    className:
      'h-1 bg-[repeating-linear-gradient(90deg,var(--map-stream)_0_6px,transparent_6px_9px)] [print-color-adjust:exact]',
  },
  { key: 'water', className: 'h-3 rounded-sm border border-(--map-stream) bg-(--map-water)/60' },
  {
    key: 'wetland',
    className:
      'h-3 rounded-sm border border-dashed border-(--map-wetland) bg-[repeating-linear-gradient(45deg,var(--map-wetland)_0_2px,transparent_2px_6px)]',
  },
] as const;

export interface HydroLegendProps {
  status: HydroStatus;
  className?: string;
  /** wspolna nazwa grupy legend (atrybut `name`): naraz rozwinieta jest tylko jedna legenda z grupy */
  group?: string;
  /** otwarta od poczatku; domyslnie zwinieta (jeden wiersz), zeby nie zaslaniala mapy */
  defaultOpen?: boolean;
}

/**
 * Legenda warstwy "Rowy i cieki": probki stylu, zrodlo "BDOT10k, GUGiK" z data danych i stan warstwy (przybliz
 * mape, chwilowo niedostepna - widoczny takze po zwinieciu). Domyslnie zwinieta - zajmuje jeden wiersz.
 */
export function HydroLegend({ status, className, group, defaultOpen = false }: HydroLegendProps) {
  const t = useTranslations('parcels.map.hydroLegend');
  const format = useFormatter();
  const date = status.importedAt
    ? format.dateTime(new Date(status.importedAt), { dateStyle: 'medium', timeZone: APP_TIME_ZONE })
    : null;
  const note = status.state === 'zoom' ? t('zoom') : status.state === 'unavailable' ? t('unavailable') : null;

  return (
    <details
      open={defaultOpen}
      name={group}
      className={cn(
        'group w-64 max-w-full rounded-lg border bg-card text-card-foreground shadow-md',
        className,
      )}
      data-testid="hydro-legend"
      data-hydro-state={status.state}
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center gap-1 px-3 py-1.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {t('title')}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
          />
        </span>
        {/* stan warstwy widac takze w zwinietej legendzie (telefon) */}
        {note && (
          <output className="rounded-md bg-muted px-2 py-1.5 font-normal text-foreground">{note}</output>
        )}
      </summary>
      <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs">
        <ul className="flex flex-col gap-1.5">
          {SWATCHES.map((swatch) => (
            <li key={swatch.key} className="flex items-center gap-2">
              <span aria-hidden="true" className="flex w-7 shrink-0 items-center">
                <span className={cn('block w-full', swatch.className)} />
              </span>
              {t(`kinds.${swatch.key}`)}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          {date ? t('sourceDated', { date }) : t('source')}
          {status.truncated ? ` ${t('truncated')}` : ''}
        </p>
      </div>
    </details>
  );
}
