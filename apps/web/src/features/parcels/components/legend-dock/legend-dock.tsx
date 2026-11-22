import { BookOpen, LoaderCircle, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

/** Stan warstw objasnianych legendami: problem (przybliz, niedostepna, brak zdjecia) albo wczytywanie. */
export type LegendDockStatus = 'idle' | 'loading' | 'attention';

const STATUS_ICON: Record<LegendDockStatus, { Icon: LucideIcon; className: string }> = {
  idle: { Icon: BookOpen, className: 'text-primary' },
  loading: { Icon: LoaderCircle, className: 'animate-spin text-primary' },
  attention: { Icon: TriangleAlert, className: 'text-warning' },
};

export interface LegendDockProps {
  /** panel legend rozwiniety na telefonie (stan w ekranie mapy) */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** nazwa warstwy na pigulce (zdjecie z satelity); bez niej pigulka mowi "Legenda" */
  layerName?: string | null;
  /** klasy paska kolorow warstwy obok nazwy */
  swatchClassName?: string | null;
  status: LegendDockStatus;
  /** legendy (harmonijka `MapLegends`) */
  children: ReactNode;
  className?: string;
}

/**
 * Legendy przy mapie w dwoch opakowaniach jednej listy. Komputer: kolumna w lewym dolnym rogu mapy (zawsze widoczna,
 * przewijana). Telefon: mala pigulka "Legenda" nad arkuszem (z paskiem kolorow zdjecia z satelity i znakiem
 * ostrzezenia przy problemie z warstwa), a po stuknieciu panel od dolu jak panel warstw - otwiera sie w nim od razu
 * najwazniejsza legenda (zdjecie z satelity, jesli jest). Escape, krzyzyk albo stukniecie poza panelem zamyka go.
 */
export function LegendDock({
  open,
  onOpenChange,
  layerName = null,
  swatchClassName = null,
  status,
  children,
  className,
}: LegendDockProps) {
  const t = useTranslations('parcels.map');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const { Icon, className: iconClassName } = STATUS_ICON[status];

  const toggleOpen = useCallback(() => onOpenChange(!open), [onOpenChange, open]);
  const close = useCallback(() => {
    onOpenChange(false);
    buttonRef.current?.focus();
  }, [onOpenChange]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) onOpenChange(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    if (open) {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close, onOpenChange]);

  // po otwarciu panelu (telefon) rozwijamy najwazniejsza legende, jesli zadna nie jest rozwinieta;
  // zdjecie z satelity jest ostatnie na liscie, a wlaczone przez rolnika - najbardziej aktualne
  useEffect(() => {
    const list = listRef.current;

    if (!open || !list || list.querySelector('details[open]')) return;

    const items = list.querySelectorAll('details');
    const preferred = list.querySelector<HTMLDetailsElement>('[data-testid="imagery-legend"] details');

    (preferred ?? items[0])?.setAttribute('open', '');
  }, [open]);

  return (
    <div ref={rootRef} className={cn('contents', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('legendButtonLabel', { layer: layerName ?? 'none', status })}
        onClick={toggleOpen}
        // telefon: lewy dolny rog widocznej mapy, tuz nad zwinietym arkuszem (`--sheet-peek` z ekranu)
        className="absolute bottom-[calc(var(--sheet-peek,7.75rem)+0.75rem)] left-3 z-10 flex h-11 max-w-[calc(100%-5rem)] items-center gap-2 rounded-full border bg-card px-3.5 text-sm font-semibold text-card-foreground shadow-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-expanded:bg-secondary lg:hidden"
        data-testid="legend-button"
        data-legend-status={status}
      >
        <Icon className={cn('size-5 shrink-0', iconClassName)} aria-hidden="true" />
        <span className="min-w-0 truncate">{layerName ?? t('legendButton')}</span>
        {swatchClassName && (
          <span
            aria-hidden="true"
            className={cn('h-2 w-8 shrink-0 rounded-full bg-linear-to-r', swatchClassName)}
          />
        )}
      </button>
      <aside
        id={panelId}
        aria-label={t('legends')}
        className={cn(
          'flex flex-col',
          'lg:absolute lg:bottom-10 lg:left-106 lg:z-10 lg:max-h-[calc(100cqh-8rem)] lg:w-72',
          // telefon: arkusz od dolu ekranu mapy nad panelem dzialek (korzen ekranu ma `container-type: size`)
          'max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:right-19 max-lg:z-30 max-lg:max-h-[72cqh] max-lg:rounded-t-xl max-lg:border-t max-lg:border-r max-lg:bg-card max-lg:pb-[env(safe-area-inset-bottom)] max-lg:text-card-foreground max-lg:shadow-[0_-8px_24px_rgb(0_0_0/0.18)]',
          !open && 'max-lg:hidden',
        )}
        data-testid="map-legends"
      >
        <header className="flex items-center justify-between gap-2 border-b py-1 pr-1 pl-4 lg:hidden">
          <h2 className="text-base font-semibold">{t('legends')}</h2>
          <button
            type="button"
            aria-label={t('legendsClose')}
            onClick={close}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [@media(hover:hover)]:hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div
          ref={listRef}
          className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg p-0.5 max-lg:p-3"
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
