import { Map as MapIcon, Satellite, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { MapLayers } from '../../schemas/map-layers.schema';

type Basemap = MapLayers['basemap'];

const BASEMAPS: readonly { basemap: Basemap; Icon: LucideIcon }[] = [
  { basemap: 'map', Icon: MapIcon },
  { basemap: 'ortho', Icon: Satellite },
];

interface BasemapButtonProps {
  basemap: Basemap;
  Icon: LucideIcon;
  active: boolean;
  onChange: (patch: Partial<MapLayers>) => void;
}

function BasemapButton({ basemap, Icon, active, onChange }: BasemapButtonProps) {
  const t = useTranslations('parcels.map.layers.items');
  const choose = useCallback(() => onChange({ basemap }), [onChange, basemap]);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={choose}
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {t(`${basemap}.label`)}
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
      className={cn('flex h-12 items-center gap-1 rounded-lg border bg-card p-1 shadow-md', className)}
      data-testid="basemap-switch"
    >
      {BASEMAPS.map(({ basemap, Icon }) => (
        <BasemapButton
          key={basemap}
          basemap={basemap}
          Icon={Icon}
          active={value === basemap}
          onChange={onChange}
        />
      ))}
    </fieldset>
  );
}
