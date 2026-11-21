import { Map as MapIcon, Satellite, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { Basemap } from '../parcel-map';

export interface BasemapToggleProps {
  value: Basemap;
  onChange: (value: Basemap) => void;
  className?: string;
}

interface OptionProps {
  option: Basemap;
  label: string;
  icon: LucideIcon;
  pressed: boolean;
  onChange: (value: Basemap) => void;
}

function Option({ option, label, icon: Icon, pressed, onChange }: OptionProps) {
  const choose = useCallback(() => onChange(option), [onChange, option]);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={choose}
      className={cn(
        'flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        pressed
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground [@media(hover:hover)]:hover:bg-secondary/70',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Przelacznik podkladu: mapa albo zdjecie lotnicze (rolnik rozpoznaje swoje pole na zdjeciu). */
export function BasemapToggle({ value, onChange, className }: BasemapToggleProps) {
  const t = useTranslations('parcels.map');

  return (
    <fieldset className={cn('inline-flex min-w-0 rounded-lg border bg-card p-1 shadow-md', className)}>
      <legend className="sr-only">{t('basemapLabel')}</legend>
      <Option
        option="map"
        label={t('basemapMap')}
        icon={MapIcon}
        pressed={value === 'map'}
        onChange={onChange}
      />
      <Option
        option="ortho"
        label={t('basemapOrtho')}
        icon={Satellite}
        pressed={value === 'ortho'}
        onChange={onChange}
      />
    </fieldset>
  );
}
