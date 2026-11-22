import { LoaderCircle, Satellite, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { ImageryChoice } from '../../hooks/use-vegetation-imagery';
import { IMAGERY_ICONS } from '../imagery-legend';
import { RAIL_PILL, RAIL_TILE, RailBadge } from '../map-rail';

type ImageryStatus = 'idle' | 'loading' | 'problem';

/** Stan pobierania jako plakietka w rogu przycisku (widac go przy zamknietym panelu i zwinietej legendzie). */
const STATUS_BADGE: Record<ImageryStatus, ReactNode> = {
  idle: null,
  loading: <LoaderCircle className="animate-spin" />,
  problem: <TriangleAlert />,
};

export interface ImageryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** wybrana warstwa obrazu (na przycisku widac, co jest wlaczone) */
  value: ImageryChoice;
  /** stan pobierania obrazu - przycisk pokazuje go takze przy zamknietym panelu i zwinietej legendzie */
  status: ImageryStatus;
  /** przelacznik obrazu z wyborem miesiaca */
  children: ReactNode;
  className?: string;
}

/**
 * Osobny przycisk "Satelita" przy mapie: rozwija maly panel z wyborem obrazu (brak / kondycja roslin / woda w
 * roslinach) i miesiaca zdjecia. Panel nie jest modalny; zamyka go Escape (fokus wraca na przycisk), klikniecie
 * poza panelem albo krzyzyk. Na telefonie panel jest arkuszem od dolu, tak jak panel warstw.
 */
export function ImageryPanel({ open, onOpenChange, value, status, children, className }: ImageryPanelProps) {
  const t = useTranslations('parcels.imagery');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const active = value !== 'none';
  // ikona mowi, co jest na mapie: satelita (nic), lisc (kondycja roslin), kropla (woda w roslinach)
  const Icon: LucideIcon = value === 'none' ? Satellite : IMAGERY_ICONS[value];
  const badge = STATUS_BADGE[status];

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

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('buttonLabel', { choice: t(`choices.${value}`) })}
        title={t('title')}
        onClick={toggleOpen}
        // telefon: kafel szyny z podpisem "Satelita"; komputer: pigulka z nazwa wybranej warstwy
        className={cn(RAIL_TILE, RAIL_PILL, active && 'border-primary')}
        data-testid="imagery-button"
        data-imagery-status={status}
      >
        <Icon className="lg:text-primary" aria-hidden="true" />
        <span className="lg:hidden">{t('button')}</span>
        <span className="max-lg:hidden">{active ? t(`choices.${value}`) : t('button')}</span>
        {badge && (
          <RailBadge
            className={cn(
              status === 'problem' ? 'bg-warning' : 'bg-card text-primary',
              'lg:-top-2 lg:-right-2',
            )}
          >
            {badge}
          </RailBadge>
        )}
      </button>
      <section
        id={panelId}
        aria-labelledby={titleId}
        hidden={!open}
        className="absolute top-full left-0 z-20 mt-2 flex max-h-[calc(100cqh-9rem)] w-80 max-w-[calc(100cqw-1.5rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg max-lg:fixed max-lg:left-0 max-lg:right-19 max-lg:top-auto max-lg:bottom-0 max-lg:mt-0 max-lg:max-h-[72cqh] max-lg:w-auto max-lg:max-w-none max-lg:rounded-b-none max-lg:border-l-0 max-lg:border-b-0 max-lg:pb-[env(safe-area-inset-bottom)] max-lg:shadow-[0_-8px_24px_rgb(0_0_0/0.18)]"
        data-testid="imagery-panel"
      >
        <header className="flex items-center justify-between gap-2 border-b py-1 pr-1 pl-4">
          <h2 id={titleId} className="text-base font-semibold">
            {t('title')}
          </h2>
          <button
            type="button"
            aria-label={t('close')}
            onClick={close}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [@media(hover:hover)]:hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain p-4">{children}</div>
      </section>
    </div>
  );
}
