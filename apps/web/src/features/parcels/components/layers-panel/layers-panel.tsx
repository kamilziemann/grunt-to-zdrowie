import { Bird, Dam, Grid2x2, Layers, Trees, Waves, X, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type ChangeEvent } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { MapLayers } from '../../schemas/map-layers.schema';
import { RAIL_PILL, RAIL_PILL_BADGE, RAIL_TILE, RailBadge } from '../map-rail';

/** Warstwy wlaczane pojedynczo (pola z wartoscia tak/nie). */
type ToggleLayer = 'boundaries' | 'hydro' | 'cover' | 'waterworks' | 'protected';

const WATER_ITEMS: readonly { layer: ToggleLayer; Icon: LucideIcon }[] = [
  { layer: 'hydro', Icon: Waves },
  { layer: 'cover', Icon: Trees },
  { layer: 'waterworks', Icon: Dam },
  { layer: 'protected', Icon: Bird },
];

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

export interface LayersPanelProps {
  /** panel rozwiniety (stan w ekranie mapy) */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layers: MapLayers;
  onChange: (patch: Partial<MapLayers>) => void;
  className?: string;
}

/** Wspolny wyglad tytulu grupy. */
const LAYER_GROUP_LEGEND = 'mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase';

/** Ile warstw nad podkladem jest wlaczonych (liczba na przycisku). */
export function activeLayerCount(layers: MapLayers): number {
  const toggles: ToggleLayer[] = ['boundaries', 'hydro', 'cover', 'waterworks', 'protected'];

  return toggles.filter((layer) => layers[layer]).length;
}

/**
 * Warstwy nakladane na mape: przycisk "Warstwy" przy mapie rozwija panel z grupami Dzialki oraz Woda i otoczenie;
 * kazda pozycja ma jedno zdanie "co tu zobacze". Podklad (mapa / zdjecie lotnicze) i zdjecie z satelity maja
 * wlasne przyciski obok. Panel nie jest modalny - zmiane warstwy od razu widac na mapie pod nim. Zamyka go Escape (fokus wraca na przycisk), klikniecie poza panelem albo krzyzyk.
 */
export function LayersPanel({ open, onOpenChange, layers, onChange, className }: LayersPanelProps) {
  const t = useTranslations('parcels.map.layers');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
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
        title={t('button')}
        onClick={toggleOpen}
        // telefon: kafel szyny z ikona i licznikiem w rogu; komputer: pigulka z napisem w rzedzie nad mapa
        className={cn(RAIL_TILE, RAIL_PILL)}
        data-testid="layers-button"
      >
        <Layers className="lg:text-primary" aria-hidden="true" />
        <span data-rail-label>{t('button')}</span>
        <RailBadge className={RAIL_PILL_BADGE}>{count}</RailBadge>
      </button>
      <section
        id={panelId}
        aria-labelledby={titleId}
        hidden={!open}
        // komputer: rozwijany panel pod przyciskiem; telefon: arkusz od dolu ekranu mapy nad panelem dzialek (korzen
        // ekranu ma `container-type: size`, wiec `fixed` liczy sie od niego), mapa zostaje widoczna nad arkuszem, a szyna
        // przyciskow obok niego (arkusz konczy sie przed nia; na niskim ekranie szyna stoi u gory w kilku kolumnach)
        className="absolute top-full left-0 z-20 mt-2 flex max-h-[calc(100cqh-9rem)] w-88 max-w-[calc(100cqw-1.5rem)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg max-lg:fixed max-lg:left-0 max-lg:right-19 max-lg:[@media(height<30rem)]:right-52 max-lg:top-auto max-lg:bottom-0 max-lg:mt-0 max-lg:max-h-[72cqh] max-lg:w-auto max-lg:max-w-none max-lg:rounded-b-none max-lg:border-l-0 max-lg:border-b-0 max-lg:pb-[env(safe-area-inset-bottom)] max-lg:shadow-[0_-8px_24px_rgb(0_0_0/0.18)]"
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
            <legend className={LAYER_GROUP_LEGEND}>{t('groups.parcels')}</legend>
            <ToggleItem layer="boundaries" Icon={Grid2x2} checked={layers.boundaries} onChange={onChange} />
          </fieldset>
          <fieldset className="flex min-w-0 flex-col gap-0.5">
            <legend className={LAYER_GROUP_LEGEND}>{t('groups.water')}</legend>
            {WATER_ITEMS.map(({ layer, Icon }) => (
              <ToggleItem key={layer} layer={layer} Icon={Icon} checked={layers[layer]} onChange={onChange} />
            ))}
          </fieldset>
        </div>
      </section>
    </div>
  );
}
