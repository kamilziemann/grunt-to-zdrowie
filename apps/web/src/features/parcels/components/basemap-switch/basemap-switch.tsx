import { Image as ImageIcon, Map as MapIcon, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { MapLayers } from '../../schemas/map-layers.schema';
import { RAIL_TILE } from '../map-rail';

type Basemap = MapLayers['basemap'];

// krotki podpis na waskim komputerze (rzad przyciskow obok panelu przy 1024 px); pelna nazwa w nazwie dostepnej
const BASEMAPS: readonly { basemap: Basemap; Icon: LucideIcon; short: 'basemapMap' | 'basemapOrtho' }[] = [
  { basemap: 'map', Icon: MapIcon, short: 'basemapMap' },
  { basemap: 'ortho', Icon: ImageIcon, short: 'basemapOrtho' },
];

interface BasemapButtonProps {
  basemap: Basemap;
  Icon: LucideIcon;
  short: 'basemapMap' | 'basemapOrtho';
  active: boolean;
  onChange: (patch: Partial<MapLayers>) => void;
}

function BasemapButton({ basemap, Icon, short, active, onChange }: BasemapButtonProps) {
  const t = useTranslations('parcels.map.layers.items');
  const tMap = useTranslations('parcels.map');
  const label = t(`${basemap}.label`);
  const choose = useCallback(() => onChange({ basemap }), [onChange, basemap]);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={choose}
      className={cn(
        'flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="xl:hidden">{tMap(short)}</span>
      <span className="max-xl:hidden">{label}</span>
    </button>
  );
}

export interface BasemapSwitchProps {
  value: Basemap;
  onChange: (patch: Partial<MapLayers>) => void;
  className?: string;
}

/**
 * Podklad mapy jako dwa przyciski obok siebie (Mapa / Zdjecie lotnicze) - najczestsza zmiana na mapie, wiec stoi
 * przy mapie pod reka, a nie w panelu warstw.
 */
export function BasemapSwitch({ value, onChange, className }: BasemapSwitchProps) {
  const t = useTranslations('parcels.map.basemap');

  return (
    <fieldset
      aria-label={t('label')}
      // komputer: dwa przyciski w ramce tej samej wysokosci co pigulki obok (48 px), segmenty wypelniaja jej wnetrze;
      // telefon ma zamiast nich kafel `BasemapToggle` w szynie
      className={cn(
        'flex h-12 shrink-0 items-stretch gap-0.5 rounded-lg border bg-card p-1 shadow-md',
        className,
      )}
      data-testid="basemap-switch"
    >
      {BASEMAPS.map(({ basemap, Icon, short }) => (
        <BasemapButton
          key={basemap}
          basemap={basemap}
          Icon={Icon}
          short={short}
          active={value === basemap}
          onChange={onChange}
        />
      ))}
    </fieldset>
  );
}

/**
 * Telefon: podklad jako jeden kafel szyny "Zdjecie" (przelacznik `aria-pressed`): wcisniety = zdjecie lotnicze,
 * zwolniony = mapa. Pelna nazwa "Zdjecie lotnicze" w nazwie dostepnej i w dymku.
 */
export function BasemapToggle({ value, onChange, className }: BasemapSwitchProps) {
  const t = useTranslations('parcels.map');
  const tItems = useTranslations('parcels.map.layers.items');
  const label = tItems('ortho.label');
  const ortho = value === 'ortho';
  const toggle = useCallback(() => onChange({ basemap: ortho ? 'map' : 'ortho' }), [onChange, ortho]);

  return (
    <button
      type="button"
      aria-pressed={ortho}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn(RAIL_TILE, className)}
      data-testid="basemap-toggle"
    >
      <ImageIcon aria-hidden="true" />
      <span aria-hidden="true" data-rail-label>
        {t('basemapOrtho')}
      </span>
    </button>
  );
}
