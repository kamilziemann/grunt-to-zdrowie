import {
  Bird,
  Dam,
  Grid2x2,
  Layers,
  Map as MapIcon,
  Satellite,
  Trees,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { MapLayers } from '../../schemas/map-layers.schema';

/** Warstwy wlaczane pojedynczo (pola z wartoscia tak/nie). */
type ToggleLayer = 'boundaries' | 'hydro' | 'cover' | 'waterworks' | 'protected';

const WATER_ITEMS: readonly { layer: ToggleLayer; Icon: LucideIcon }[] = [
  { layer: 'hydro', Icon: Waves },
  { layer: 'cover', Icon: Trees },
  { layer: 'waterworks', Icon: Dam },
  { layer: 'protected', Icon: Bird },
];

const BASEMAPS = [
  { basemap: 'map', Icon: MapIcon },
  { basemap: 'ortho', Icon: Satellite },
] as const;

const ROW =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/60 [@media(hover:hover)]:hover:bg-muted';
const INPUT = 'mt-0.5 size-5 shrink-0 cursor-pointer accent-primary outline-none';

interface ItemTextProps {
  Icon: LucideIcon;
  label: string;
  hint: string;
  /** prefiks identyfikatorow: `<id>-label` (nazwa pola) i `<id>-hint` (opis) */
  id: string;
}

/** Nazwa i zdanie "co tu zobacze"; pole wyboru bierze nazwe z pierwszego, a opis z drugiego. */
function ItemText({ Icon, label, hint, id }: ItemTextProps) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span id={`${id}-label`}>{label}</span>
      </span>
      <span id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </span>
    </span>
  );
}

interface ToggleItemProps {
  layer: ToggleLayer;
  Icon: LucideIcon;
  checked: boolean;
  onChange: (patch: Partial<MapLayers>) => void;
  className?: string;
}

function ToggleItem({ layer, Icon, checked, onChange, className }: ToggleItemProps) {
  const t = useTranslations('parcels.map.layers.items');
  const id = useId();
  const toggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange({ [layer]: event.currentTarget.checked }),
    [onChange, layer],
  );

  return (
    <label className={cn(ROW, className)}>
      <input
        type="checkbox"
        name={layer}
        checked={checked}
        onChange={toggle}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className={INPUT}
      />
      <ItemText Icon={Icon} label={t(`${layer}.label`)} hint={t(`${layer}.hint`)} id={id} />
    </label>
  );
}

interface BasemapItemProps {
  basemap: MapLayers['basemap'];
  Icon: LucideIcon;
  name: string;
  checked: boolean;
  onChange: (patch: Partial<MapLayers>) => void;
}

function BasemapItem({ basemap, Icon, name, checked, onChange }: BasemapItemProps) {
  const t = useTranslations('parcels.map.layers.items');
  const id = useId();
  const choose = useCallback(() => onChange({ basemap }), [onChange, basemap]);

  return (
    <label className={ROW}>
      <input
        type="radio"
        name={name}
        value={basemap}
        checked={checked}
        onChange={choose}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className={INPUT}
      />
      <ItemText Icon={Icon} label={t(`${basemap}.label`)} hint={t(`${basemap}.hint`)} id={id} />
    </label>
  );
}

export interface LayersPanelProps {
  /** panel rozwiniety (stan w ekranie: wybor zdjecia z satelity na telefonie zamyka panel, zeby bylo widac pole) */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layers: MapLayers;
  onChange: (patch: Partial<MapLayers>) => void;
  /** grupa "Zdjecie z satelity" (przelacznik obrazu z wlasnym stanem i wyborem miesiaca) */
  children?: ReactNode;
  className?: string;
}

/** Wspolny wyglad tytulu grupy (takze w przelaczniku zdjecia z satelity). */
export const LAYER_GROUP_LEGEND =
  'mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase';

/** Ile warstw nad podkladem jest wlaczonych (liczba na przycisku). */
export function activeLayerCount(layers: MapLayers): number {
  const toggles: ToggleLayer[] = ['boundaries', 'hydro', 'cover', 'waterworks', 'protected'];

  return toggles.filter((layer) => layers[layer]).length + (layers.imagery === 'none' ? 0 : 1);
}

/**
 * Jedno miejsce na warstwy mapy: przycisk "Warstwy" przy mapie rozwija panel z grupami Podklad, Woda i otoczenie,
 * Zdjecie z satelity; kazda pozycja ma jedno zdanie "co tu zobacze". Panel nie jest modalny - zmiana warstwy od
 * razu widac na mapie pod nim. Zamyka go Escape (fokus wraca na przycisk), klikniecie poza panelem albo krzyzyk.
 */
export function LayersPanel({ open, onOpenChange, layers, onChange, children, className }: LayersPanelProps) {
  const t = useTranslations('parcels.map.layers');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const basemapName = useId();
  const count = activeLayerCount(layers);

  const toggleOpen = useCallback(() => onOpenChange(!open), [onOpenChange, open]);
  const close = useCallback(() => {
    onOpenChange(false);
    buttonRef.current?.focus();
  }, [onOpenChange]);

  // klikniecie albo stukniecie poza panelem (np. w mape) zamyka go; Escape tez, z fokusem z powrotem na przycisku
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
        aria-label={t('buttonLabel', { count })}
        onClick={toggleOpen}
        className="flex h-12 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold text-card-foreground shadow-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-expanded:bg-secondary"
        data-testid="layers-button"
      >
        <Layers className="size-5 text-primary" aria-hidden="true" />
        {t('button')}
        <span
          aria-hidden="true"
          className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums"
        >
          {count}
        </span>
      </button>
      <section
        id={panelId}
        aria-labelledby={titleId}
        hidden={!open}
        // komputer: rozwijany panel pod przyciskiem; telefon: arkusz od dolu ekranu mapy nad panelem dzialek (korzen
        // ekranu ma `container-type: size`, wiec `fixed` liczy sie od niego), mapa zostaje widoczna nad arkuszem
        className="absolute top-full left-0 z-20 mt-2 flex max-h-[calc(100cqh-9rem)] w-88 max-w-[calc(100cqw-1.5rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:mt-0 max-md:max-h-[72cqh] max-md:w-auto max-md:max-w-none max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-[0_-8px_24px_rgb(0_0_0/0.18)]"
        data-testid="layers-panel"
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
        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-3">
          <fieldset className="flex min-w-0 flex-col gap-0.5">
            <legend className={LAYER_GROUP_LEGEND}>{t('groups.base')}</legend>
            {BASEMAPS.map(({ basemap, Icon }) => (
              <BasemapItem
                key={basemap}
                basemap={basemap}
                Icon={Icon}
                name={basemapName}
                checked={layers.basemap === basemap}
                onChange={onChange}
              />
            ))}
            <ToggleItem
              layer="boundaries"
              Icon={Grid2x2}
              checked={layers.boundaries}
              onChange={onChange}
              className="mt-1 border-t pt-3"
            />
          </fieldset>
          <fieldset className="flex min-w-0 flex-col gap-0.5">
            <legend className={LAYER_GROUP_LEGEND}>{t('groups.water')}</legend>
            {WATER_ITEMS.map(({ layer, Icon }) => (
              <ToggleItem key={layer} layer={layer} Icon={Icon} checked={layers[layer]} onChange={onChange} />
            ))}
          </fieldset>
          <div className="px-2 pb-1">{children}</div>
        </div>
      </section>
    </div>
  );
}
