import { CROP_IDS, cropIdSchema, type CropId } from '@app/contracts';
import { Check } from 'lucide-react';
import { useCallback, type ChangeEvent } from 'react';
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
}

/**
 * Wybor uprawy: 15 pozycji z katalogu jako duze pola wyboru (cel dotykowy >= 56 px) z nazwa dla rolnika i
 * przykladami. Natywne radio - klawiatura i czytnik ekranu dzialaja bez dodatkowego kodu.
 */
export function CropPicker({ value, onChange, name, errorId, invalid = false }: CropPickerProps) {
  const t = useTranslations('analysis');
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
      aria-describedby={invalid ? errorId : undefined}
      aria-invalid={invalid || undefined}
    >
      <legend className="mb-3 text-lg font-semibold">{t('form.cropLegend')}</legend>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {CROP_IDS.map((cropId) => {
          const checked = value === cropId;

          return (
            <label
              key={cropId}
              data-crop={cropId}
              className={cn(
                'relative flex min-h-14 cursor-pointer flex-col justify-center gap-0.5 rounded-lg border bg-card py-2 pr-8 pl-3 transition-colors select-none hover:bg-secondary/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60',
                checked ? 'border-primary bg-primary/10 hover:bg-primary/10' : 'border-input',
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
              <span className="text-base leading-snug font-medium">{t(`crops.${cropId}.name`)}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {t(`crops.${cropId}.examples`)}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-2 right-2 flex size-5 items-center justify-center rounded-full border',
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}
              >
                {checked ? <Check className="size-3.5" /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
