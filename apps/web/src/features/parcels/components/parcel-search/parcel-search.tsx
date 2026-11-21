import { Search } from 'lucide-react';
import { useCallback, useId, type ChangeEvent, type SubmitEvent } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

import type { ParcelSearchError } from '../../schemas/parcel-search.schema';

export interface ParcelSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** pole dostalo fokus (telefon: rozwin arkusz, zeby klawiatura nie zaslonila wynikow) */
  onFocus?: () => void;
  pending?: boolean;
  error?: ParcelSearchError | null;
  /** na telefonie podpowiedz ustepuje miejsca wynikom (podglad dzialki, lista kandydatow) */
  compact?: boolean;
}

/**
 * Jedno pole na oba sposoby szukania: pelny numer dzialki albo "obreb numer". Tekst 16 px (iOS nie przybliza strony
 * przy fokusie), klawisz "Szukaj" na klawiaturze telefonu, bez autokorekty (numery i nazwy wlasne).
 */
export function ParcelSearch({
  value,
  onChange,
  onSubmit,
  onFocus,
  pending = false,
  error = null,
  compact = false,
}: ParcelSearchProps) {
  const t = useTranslations('parcels.search');
  const inputId = useId();
  const messageId = useId();
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  );
  const submit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit();
    },
    [onSubmit],
  );

  return (
    <search>
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <label htmlFor={inputId} className="sr-only">
          {t('label')}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            name="q"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            placeholder={t('placeholder')}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            onChange={change}
            onFocus={onFocus}
            className="h-12 text-base"
          />
          <Button type="submit" size="xl" loading={pending} aria-label={t('submit')} className="px-4">
            {!pending && <Search aria-hidden="true" />}
            <span className="max-sm:sr-only">{t('submit')}</span>
          </Button>
        </div>
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn(
            'text-sm',
            error
              ? 'text-destructive'
              : 'text-muted-foreground max-md:group-data-[snap=peek]/sheet:invisible',
            compact && !error && 'max-md:hidden',
          )}
        >
          {error ? t(error) : t('hint')}
        </p>
      </form>
    </search>
  );
}
