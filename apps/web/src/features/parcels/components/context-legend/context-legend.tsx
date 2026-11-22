import { CONTEXT_LAYERS, type ContextLayer } from '@app/contracts';
import { ChevronDown } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import type { ContextVisibility, LayerStatus } from '../parcel-map';

/** Probki legendy rysowane tymi samymi tokenami co warstwy na mapie (`--map-*`), z tym samym wzorem linii i znakiem. */
type SwatchKey =
  | 'forest'
  | 'treeRow'
  | 'hedge'
  | 'structure'
  | 'levee'
  | 'piped'
  | 'spring'
  | 'intake'
  | 'park'
  | 'natura';

const SWATCHES: Record<ContextLayer, readonly { key: SwatchKey; className: string }[]> = {
  cover: [
    { key: 'forest', className: 'h-3 rounded-sm border border-(--map-forest) bg-(--map-forest)/35' },
    {
      key: 'treeRow',
      className:
        'h-1.5 bg-[radial-gradient(circle,var(--map-tree-row)_2.5px,transparent_3px)] bg-size-[8px_6px] [print-color-adjust:exact]',
    },
    {
      key: 'hedge',
      className:
        'h-1 bg-[repeating-linear-gradient(90deg,var(--map-tree-row)_0_6px,transparent_6px_9px)] [print-color-adjust:exact]',
    },
  ],
  waterworks: [
    {
      key: 'structure',
      className:
        'mx-auto size-3 border-2 border-(--map-casing) bg-(--map-structure) outline outline-(--map-structure)',
    },
    { key: 'levee', className: 'h-1.5 rounded-full bg-(--map-levee) ring-2 ring-(--map-casing)' },
    {
      key: 'piped',
      className:
        'h-1 bg-[repeating-linear-gradient(90deg,var(--map-piped)_0_4px,transparent_4px_8px)] [print-color-adjust:exact]',
    },
    {
      key: 'spring',
      className: 'mx-auto size-3 rounded-full border-[2.5px] border-(--map-spring) bg-(--map-casing)',
    },
    {
      key: 'intake',
      className:
        'mx-auto size-3 rounded-full border-2 border-(--map-casing) bg-(--map-spring) outline outline-(--map-spring)',
    },
  ],
  protected: [
    { key: 'park', className: 'h-3 rounded-sm border-2 border-(--map-protected) bg-(--map-protected)/15' },
    {
      key: 'natura',
      className: 'h-3 rounded-sm border-2 border-dashed border-(--map-protected) bg-(--map-protected)/15',
    },
  ],
};

export interface ContextLegendProps {
  /** wlaczone warstwy - legenda pokazuje tylko je */
  enabled: ContextVisibility;
  statuses: Readonly<Record<ContextLayer, LayerStatus>>;
  className?: string;
}

/** Najwazniejszy stan wlaczonych warstw: niedostepna > ladowanie > za male przyblizenie > gotowa. */
function overallNote(layers: readonly ContextLayer[], statuses: ContextLegendProps['statuses']) {
  const states = layers.map((layer) => statuses[layer].state);

  if (states.includes('unavailable')) return 'unavailable';

  if (states.includes('loading')) return 'loading';

  if (states.length > 0 && states.every((state) => state === 'zoom')) return 'zoom';

  return null;
}

/**
 * Legenda warstw "otoczenie pola" (drzewa, budowle wodne i waly, obszary chronione): probki tylko wlaczonych warstw,
 * zrodlo BDOT10k z data danych, stan (wczytywanie, baza nie odpowiada, przybliz) widoczny takze po zwinieciu.
 * Domyslnie zwinieta - zajmuje jeden wiersz.
 */
export function ContextLegend({ enabled, statuses, className }: ContextLegendProps) {
  const t = useTranslations('parcels.map.contextLegend');
  const format = useFormatter();
  const layers = CONTEXT_LAYERS.filter((layer) => enabled[layer]);
  const imported = layers
    .map((layer) => statuses[layer].importedAt)
    .reduce<string | null>((latest, value) => (value && (!latest || value > latest) ? value : latest), null);
  const date = imported
    ? format.dateTime(new Date(imported), { dateStyle: 'medium', timeZone: APP_TIME_ZONE })
    : null;
  const truncated = layers.some((layer) => statuses[layer].truncated);
  const note = overallNote(layers, statuses);

  return (
    <details
      className={cn(
        'group w-64 max-w-full rounded-lg border bg-card text-card-foreground shadow-md',
        className,
      )}
      data-testid="context-legend"
      data-context-state={note ?? 'ready'}
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center gap-1 px-3 py-1.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {t('title')}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
          />
        </span>
        {note && (
          <output className="rounded-md bg-muted px-2 py-1.5 font-normal text-foreground">{t(note)}</output>
        )}
        {!note && truncated && (
          <output className="rounded-md bg-muted px-2 py-1.5 font-normal text-foreground">
            {t('truncated')}
          </output>
        )}
      </summary>
      <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs">
        {layers.map((layer) => (
          <section key={layer} aria-label={t(`groups.${layer}`)} className="flex flex-col gap-1.5">
            <p className="font-semibold">{t(`groups.${layer}`)}</p>
            <ul className="flex flex-col gap-1.5">
              {SWATCHES[layer].map((swatch) => (
                <li key={swatch.key} className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex w-7 shrink-0 items-center">
                    <span className={cn('block w-full', swatch.className)} />
                  </span>
                  {t(`kinds.${swatch.key}`)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-muted-foreground">{date ? t('sourceDated', { date }) : t('source')}</p>
      </div>
    </details>
  );
}
