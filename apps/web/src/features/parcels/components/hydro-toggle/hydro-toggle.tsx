import { Waves } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

export interface HydroToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

/**
 * Wlacznik warstwy "Rowy i cieki" (BDOT10k) obok granic dzialek: rolnik widzi, ktory row biegnie przy polu i gdzie
 * jest najblizszy ciek - od tego zaczynaja sie zalecenia retencji (zastawka, oczko).
 */
export function HydroToggle({ value, onChange, className }: HydroToggleProps) {
  const t = useTranslations('parcels.map');
  const toggle = useCallback(() => onChange(!value), [onChange, value]);

  return (
    <button
      type="button"
      aria-pressed={value}
      title={t('hydroHint')}
      onClick={toggle}
      className={cn(
        'flex h-13 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium shadow-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        value ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 items-center justify-center rounded-md',
          value ? 'bg-water text-water-foreground' : 'bg-muted',
        )}
      >
        <Waves className="size-4" />
      </span>
      {t('hydro')}
    </button>
  );
}
