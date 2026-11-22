import { LoaderCircle, Satellite, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { ImageryChoice } from '../../hooks/use-vegetation-imagery';

type ImageryStatus = 'idle' | 'loading' | 'problem';

const STATUS_ICON: Record<ImageryStatus, { Icon: LucideIcon; className: string }> = {
  idle: { Icon: Satellite, className: 'text-primary' },
  loading: { Icon: LoaderCircle, className: 'animate-spin text-primary' },
  problem: { Icon: TriangleAlert, className: 'text-warning' },
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

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('buttonLabel', { choice: t(`choices.${value}`) })}
        onClick={toggleOpen}
        className={cn(
          'flex h-12 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold text-card-foreground shadow-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-expanded:bg-secondary',
          active && 'border-primary',
        )}
        data-testid="imagery-button"
        data-imagery-status={status}
      >
        <Icon className={cn('size-5', iconClassName)} aria-hidden="true" />
        {/* telefon: krotka nazwa (pelna jest w nazwie dostepnej i w legendzie), zeby przyciski miescily sie w dwoch rzedach */}
        <span className="md:hidden">{t('button')}</span>
        <span className="max-md:hidden">{active ? t(`choices.${value}`) : t('button')}</span>
      </button>
      <section
        id={panelId}
        aria-labelledby={titleId}
        hidden={!open}
        className="absolute top-full left-0 z-20 mt-2 flex max-h-[calc(100cqh-9rem)] w-80 max-w-[calc(100cqw-1.5rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:mt-0 max-md:max-h-[72cqh] max-md:w-auto max-md:max-w-none max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-[0_-8px_24px_rgb(0_0_0/0.18)]"
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
