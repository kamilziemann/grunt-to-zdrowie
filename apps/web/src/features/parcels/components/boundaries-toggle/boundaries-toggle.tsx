import { Grid2x2 } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

export interface BoundariesToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

/**
 * Wlacznik warstwy granic i numerow wszystkich dzialek (ewidencja gruntow). Osobno od podkladu, bo dziala i na
 * mapie, i na zdjeciu; rolnik widzi sasiednie dzialki i wie, w ktora kliknac.
 */
export function BoundariesToggle({ value, onChange, className }: BoundariesToggleProps) {
  const t = useTranslations('parcels.map');
  const toggle = useCallback(() => onChange(!value), [onChange, value]);

  return (
    <button
      type="button"
      aria-pressed={value}
      title={t('boundariesHint')}
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
        <Grid2x2 className="size-4" />
      </span>
      {t('boundaries')}
    </button>
  );
}
