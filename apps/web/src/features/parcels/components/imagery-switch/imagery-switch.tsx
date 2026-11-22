import { Ban } from 'lucide-react';
import { useCallback, useId, useMemo, type ChangeEvent } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import type { ImageryChoice } from '../../hooks/use-vegetation-imagery';
import { imageryMonths } from '../../utils/imagery-months';
import { IMAGERY_ICONS } from '../imagery-legend';

export interface ImagerySwitchProps {
  value: ImageryChoice;
  onChange: (value: ImageryChoice) => void;
  /** wybrany miesiac RRRR-MM; null = najnowsze zdjecie */
  month: string | null;
  onMonthChange: (month: string | null) => void;
  /** dzis (RRRR-MM-DD) - od niego liczymy liste miesiecy */
  today: string;
  /** false = lista "moje dzialki" jest pusta (obraz liczymy tylko dla wybranych dzialek) */
  enabled: boolean;
  className?: string;
  /** wyglad tytulu grupy (w panelu warstw taki jak tytuly pozostalych grup) */
  legendClassName?: string;
}

const CHOICES = [
  { choice: 'none', Icon: Ban },
  { choice: 'condition', Icon: IMAGERY_ICONS.condition },
  { choice: 'moisture', Icon: IMAGERY_ICONS.moisture },
] as const;

const LATEST = 'latest';

function choiceOf(value: string): ImageryChoice {
  return CHOICES.find((item) => item.choice === value)?.choice ?? 'none';
}

/**
 * Przelacznik obrazu z satelity na mapie (brak / Kondycja roslin / Woda w roslinach) jako grupa radiowa i wybor
 * miesiaca zdjecia. Nieaktywny, dopoki na liscie nie ma dzialki - obraz liczymy tylko dla wybranych pol.
 */
export function ImagerySwitch({
  value,
  onChange,
  month,
  onMonthChange,
  today,
  enabled,
  className,
  legendClassName,
}: ImagerySwitchProps) {
  const t = useTranslations('parcels.imagery');
  const format = useFormatter();
  const name = useId();
  const hintId = useId();
  const monthId = useId();
  const months = useMemo(() => imageryMonths(today), [today]);
  const select = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(choiceOf(event.currentTarget.value)),
    [onChange],
  );
  const selectMonth = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.currentTarget.value;

      onMonthChange(next === LATEST ? null : next);
    },
    [onMonthChange],
  );
  const current = enabled ? value : 'none';

  return (
    <fieldset
      disabled={!enabled}
      aria-describedby={hintId}
      className={cn('flex min-w-0 flex-col gap-2', className)}
      data-testid="imagery-switch"
    >
      <legend className={cn('mb-2 text-base font-semibold', legendClassName)}>{t('title')}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {CHOICES.map(({ choice, Icon }) => (
          <label
            key={choice}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-center text-xs leading-tight font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/60',
              enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              current === choice
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground',
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice}
              checked={current === choice}
              onChange={select}
              className="sr-only"
            />
            <Icon className="size-4" aria-hidden="true" />
            {t(`choices.${choice}`)}
          </label>
        ))}
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {t(enabled ? 'hint' : 'needParcel')}
      </p>
      {enabled && current !== 'none' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={monthId} className="text-sm font-medium">
            {t('month')}
          </label>
          <select
            id={monthId}
            value={month ?? LATEST}
            onChange={selectMonth}
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <option value={LATEST}>{t('latest')}</option>
            {months.slice(1).map((item) => (
              <option key={item} value={item}>
                {format.dateTime(new Date(`${item}-15T12:00:00Z`), { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}
