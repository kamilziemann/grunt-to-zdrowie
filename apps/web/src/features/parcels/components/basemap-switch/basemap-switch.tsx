import { Map as MapIcon, Satellite, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { MapLayers } from '../../schemas/map-layers.schema';

type Basemap = MapLayers['basemap'];

// krotki podpis na telefonie (jeden rzad przyciskow przy 360 px); pelna nazwa zostaje w nazwie dostepnej
const BASEMAPS: readonly { basemap: Basemap; Icon: LucideIcon; short: 'basemapMap' | 'basemapOrtho' }[] = [
  { basemap: 'map', Icon: MapIcon, short: 'basemapMap' },
  { basemap: 'ortho', Icon: Satellite, short: 'basemapOrtho' },
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
        'flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset max-md:h-full max-md:rounded-none max-md:px-2',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0 max-md:hidden" aria-hidden="true" />
      <span className="md:hidden">{tMap(short)}</span>
      <span className="max-md:hidden">{label}</span>
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
      // telefon: dwa segmenty na pelna wysokosc pigulki (cel dotykowy 46 px), komputer: przyciski w ramce
      className={cn(
        'flex h-12 shrink-0 items-center gap-1 rounded-lg border bg-card p-1 shadow-md max-md:gap-0 max-md:overflow-hidden max-md:p-0',
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
