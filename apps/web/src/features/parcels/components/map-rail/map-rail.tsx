// Szyna przyciskow przy mapie: wspolny wyglad kafla (bialy, kwadratowy, mocno zaokraglony, sama ikona)
// i przyciski przyblizania oraz "gdzie jestem" rysowane przez ekran zamiast domyslnych kontrolek MapLibre.
import { LoaderCircle, LocateFixed, Minus, Plus, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { LocateState, MapControls } from '../parcel-map';

/**
 * Kafel szyny: 56 x 56 px, sama ikona 24 px. Podpisy pod ikonami zaslanialy mape (decyzja wlasciciela 2026-11-22),
 * wiec napis oznaczony `data-rail-label` zostaje tylko dla czytnikow ekranu, a przycisk ma dymek `title`.
 * `aria-pressed` (np. podklad "Zdjecie") i `aria-expanded` (otwarty panel) wypelniaja kafel jak aktywny segment.
 */
export const RAIL_TILE =
  'relative flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border bg-card px-0.5 text-center text-xs leading-none font-semibold text-card-foreground shadow-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60 aria-expanded:bg-secondary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground [&>[data-rail-label]]:sr-only [&>svg]:size-6 [&>svg]:shrink-0';

/** Komputer (od `lg`): ten sam przycisk jako pigulka z ikona i napisem w jednym wierszu (jest miejsce w rzedzie). */
export const RAIL_PILL =
  'lg:h-12 lg:w-auto lg:flex-row lg:gap-2 lg:px-3 lg:text-sm lg:leading-normal lg:whitespace-nowrap lg:[&>[data-rail-label]]:not-sr-only lg:[&>svg]:size-5';

/** Plakietka licznika w pigulce na komputerze: w wierszu za napisem, nie w rogu. */
export const RAIL_PILL_BADGE = 'lg:static lg:h-6 lg:min-w-6 lg:border-0 lg:px-1.5 lg:text-xs';

/** Plakietka w prawym gornym rogu kafla: licznik albo stan (kreciolek, ostrzezenie). */
export function RailBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-card bg-primary px-1 text-[0.6875rem] text-primary-foreground tabular-nums [&>svg]:size-3.5',
        className,
      )}
    >
      {children}
    </span>
  );
}

const ZOOM_HALF =
  'flex min-h-12 w-full flex-1 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset disabled:opacity-60 [@media(hover:hover)]:hover:bg-muted';

const LOCATE_BADGE: Partial<Record<LocateState, ReactNode>> = {
  searching: <LoaderCircle className="animate-spin" />,
  denied: <TriangleAlert />,
  unavailable: <TriangleAlert />,
  outside: <TriangleAlert />,
};

export interface MapZoomLocateProps {
  /** polecenia mapy; null = mapa jeszcze sie wczytuje (przyciski nieaktywne) */
  controls: MapControls | null;
  locate: LocateState;
  className?: string;
}

/**
 * Przyblizanie (jeden kafel z dwiema polowkami) i "Gdzie jestem" w wygladzie reszty szyny. Stan szukania polozenia
 * widac na plakietce; komunikat slowny (brak zgody, niedostepne) pokazuje ekran mapy.
 */
export function MapZoomLocate({ controls, locate, className }: MapZoomLocateProps) {
  const t = useTranslations('parcels.map');
  const badge = LOCATE_BADGE[locate];

  return (
    <div className={className}>
      <div className="flex w-14 shrink-0 flex-col divide-y overflow-hidden rounded-lg border bg-card text-card-foreground shadow-md [&_svg]:size-5.5">
        <button
          type="button"
          aria-label={t('zoomIn')}
          title={t('zoomIn')}
          disabled={!controls}
          onClick={controls?.zoomIn}
          className={ZOOM_HALF}
          data-map-button="zoom-in"
        >
          <Plus aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t('zoomOut')}
          title={t('zoomOut')}
          disabled={!controls}
          onClick={controls?.zoomOut}
          className={ZOOM_HALF}
          data-map-button="zoom-out"
        >
          <Minus aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        // nazwa = ukryty napis kafla ("Gdzie jestem"), pelniejszy opis w dymku
        title={t('locate')}
        disabled={!controls}
        onClick={controls?.locate}
        className={cn(RAIL_TILE, locate === 'found' && 'text-primary')}
        data-map-button="locate"
        data-locate-state={locate}
      >
        <LocateFixed aria-hidden="true" />
        <span data-rail-label>{t('locateShort')}</span>
        {badge && (
          <RailBadge className={locate === 'searching' ? undefined : 'bg-warning'}>{badge}</RailBadge>
        )}
      </button>
    </div>
  );
}
