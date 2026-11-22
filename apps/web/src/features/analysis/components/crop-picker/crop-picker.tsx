import { CROP_IDS, cropIdSchema, type CropId } from '@app/contracts';
import { Check } from 'lucide-react';
import { useCallback, useId, type ChangeEvent } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

export interface CropPickerProps {
  value: CropId | null;
  onChange: (cropId: CropId) => void;
  /** nazwa pola formularza (wysylka GET bez JavaScriptu) */
  name: string;
  /** id komunikatu bledu pod lista (aria-describedby) */
  errorId?: string;
  invalid?: boolean;
  /** komunikat bledu - zaraz pod pytaniem, zeby po przewinieciu do grupy bylo go widac nad pigulkami */
  error?: string | null;
}

/** Najczestsze uprawy w Polsce najpierw (zboza, kukurydza, rzepak, laki), potem rzadsze. */
const COMMON_FIRST: readonly CropId[] = [
  'winter_wheat',
  'spring_barley',
  'maize_grain',
  'maize_silage',
  'winter_rapeseed',
  'grassland',
  'potato',
  'sugar_beet',
  'pulses',
  'field_vegetables',
  'strawberry',
  'fruit_trees',
  'berry_shrubs',
  'hops',
  'tobacco',
];

// kazda uprawa z katalogu musi byc na liscie (nowa uprawa w kontrakcie trafia na koniec)
const ORDER: readonly CropId[] = [...COMMON_FIRST, ...CROP_IDS.filter((id) => !COMMON_FIRST.includes(id))];

/**
 * "Co rosnie na dzialce?": wszystkie uprawy z katalogu jako pigulki 48 px (najczestsze pierwsze), pod spodem
 * przyklady wybranej uprawy. Natywne radio - klawiatura (strzalki) i czytnik ekranu dzialaja bez dodatkowego kodu.
 */
export function CropPicker({
  value,
  onChange,
  name,
  errorId,
  invalid = false,
  error = null,
}: CropPickerProps) {
  const t = useTranslations('analysis');
  const examplesId = useId();
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = cropIdSchema.safeParse(event.currentTarget.value);

      if (parsed.success) onChange(parsed.data);
    },
    [onChange],
  );

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-3"
      aria-describedby={cn(invalid && errorId, value && examplesId) || undefined}
      aria-invalid={invalid || undefined}
    >
      <legend className="mb-3 text-lg font-medium">{t('form.cropLegend')}</legend>
      {error && (
        <p id={errorId} className="-mt-1 text-base font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {ORDER.map((cropId) => {
          const checked = value === cropId;

          return (
            <label
              key={cropId}
              data-crop={cropId}
              className={cn(
                'relative inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-base transition-colors select-none has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                checked
                  ? 'border-accent bg-accent font-semibold text-accent-foreground'
                  : 'border-input hover:border-foreground',
                invalid && !value && 'border-destructive',
              )}
            >
              <input
                type="radio"
                name={name}
                value={cropId}
                checked={checked}
                onChange={handleChange}
                className="sr-only"
              />
              {checked && <Check aria-hidden="true" className="size-4" strokeWidth={3} />}
              {t(`crops.${cropId}.name`)}
            </label>
          );
        })}
      </div>
      {value && (
        <p id={examplesId} className="text-sm text-muted-foreground">
          {t('form.cropExamples', { examples: t(`crops.${value}.examples`) })}
        </p>
      )}
    </fieldset>
  );
}
