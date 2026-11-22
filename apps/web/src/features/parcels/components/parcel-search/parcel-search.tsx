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
  pending?: boolean;
  error?: ParcelSearchError | null;
  /**
   * `panel` - pole z przyciskiem "Szukaj" i podpowiedzia pod spodem (panel boczny na komputerze);
   * `map` - jedna pigulka na gorze mapy (telefon): krotki opis w polu, podpowiedz tylko dla czytnikow, blad w dymku
   */
  variant?: 'panel' | 'map';
  className?: string;
}

/**
 * Jedno pole na oba sposoby szukania: pelny numer dzialki albo "obreb numer". Tekst 16 px (iOS nie przybliza strony
 * przy fokusie), klawisz "Szukaj" na klawiaturze telefonu, bez autokorekty (numery i nazwy wlasne).
 */
export function ParcelSearch({
  value,
  onChange,
  onSubmit,
  pending = false,
  error = null,
  variant = 'panel',
  className,
}: ParcelSearchProps) {
  const t = useTranslations('parcels.search');
  const inputId = useId();
  const messageId = useId();
  const onMap = variant === 'map';
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
    <search className={className}>
      <form onSubmit={submit} className={cn('flex flex-col gap-2', onMap && 'relative')} noValidate>
        <label htmlFor={inputId} className="sr-only">
          {t('label')}
        </label>
        <div className={cn('flex gap-2', onMap && 'relative')}>
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
            placeholder={onMap ? t('placeholderShort') : t('placeholder')}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            onChange={change}
            className={cn(
              'h-12 text-base',
              onMap && 'pr-14 shadow-md [&::-webkit-search-cancel-button]:hidden',
            )}
          />
          {onMap ? (
            // przycisk w pigulce: ikona lupy z nazwa dostepna "Szukaj" (podpis zajalby pol pola na waskim ekranie)
            <Button
              type="submit"
              size="icon"
              loading={pending}
              aria-label={t('submit')}
              className="absolute top-0.5 right-0.5 size-11"
            >
              {!pending && <Search aria-hidden="true" />}
            </Button>
          ) : (
            <Button type="submit" size="xl" loading={pending} aria-label={t('submit')} className="px-4">
              {!pending && <Search aria-hidden="true" />}
              <span className="max-sm:sr-only">{t('submit')}</span>
            </Button>
          )}
        </div>
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn(
            'text-sm',
            error ? 'text-destructive' : 'text-muted-foreground',
            // na mapie blad stoi w dymku pod polem (nad przyciskami mapy), a podpowiedz slysza tylko czytniki
            onMap && !error && 'sr-only',
            onMap &&
              error &&
              'absolute inset-x-0 top-full z-10 mt-2 rounded-lg border bg-card px-3 py-2 shadow-md',
          )}
        >
          {error ? t(error) : t('hint')}
        </p>
      </form>
    </search>
  );
}
