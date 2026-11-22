import type { CropId } from '@app/contracts';
import { ArrowRight } from 'lucide-react';
import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localizePath, useAppLocale } from '@/lib/locale';
import { useRouter } from '@/lib/navigation';
import { routes, type FieldSearch } from '@/lib/routes';

import {
  analysisDateBounds,
  analysisSearchOf,
  todayInPoland,
  validateAnalysisDate,
  type AnalysisDateError,
} from '../../schemas/analysis-search.schema';
import { useToday } from '../../hooks/use-today';
import { CropPicker } from '../crop-picker';

export interface AnalysisFormProps {
  /** dzialki z adresu strony - pole analizy (przy wlasnym obszarze: dzialki, z ktorych go wycieto) */
  parcelIds: readonly string[];
  /** wlasny obszar z adresu (D3) - jedzie dalej do raportu bez zmian */
  area?: FieldSearch;
  /** uprawa wybrana wczesniej (powrot z raportu "zmien uprawe lub date") */
  initialCropId?: CropId;
  initialDate?: string;
  /** tresc nad wyborem uprawy (podsumowanie dzialek) - pasek z przyciskiem przykleja sie do dolu calosci */
  children?: ReactNode;
}

/**
 * Drugi krok ("Czy to Twoja dzialka?"): uprawa jako pigulki i dzien (dzis albo inny dzien z 10 lat), potem raport.
 * Stoi w ciemnym panelu (`surface-panel`). Bez JavaScriptu formularz wysyla GET na `/raport` (te same nazwy pol co
 * parametry adresu); z JavaScriptem sprawdza pola i przechodzi bez przeladowania. Przycisk "Analizuj dzialke" jest
 * przyklejony do dolu panelu, wiec na telefonie zawsze go widac.
 */
export function AnalysisForm({ parcelIds, area, initialCropId, initialDate, children }: AnalysisFormProps) {
  const t = useTranslations('analysis.form');
  const format = useFormatter();
  const locale = useAppLocale();
  const router = useRouter();
  const today = useToday();
  const ids = useId();
  const cropErrorId = `${ids}-crop-error`;
  const dateId = `${ids}-date`;
  const dateHintId = `${ids}-date-hint`;
  const dateErrorId = `${ids}-date-error`;
  const formRef = useRef<HTMLFormElement>(null);
  const [cropId, setCropId] = useState<CropId | null>(initialCropId ?? null);
  // null = "dzis" (data przychodzi z przegladarki po hydratacji)
  const [date, setDate] = useState<string | null>(initialDate ?? null);
  const [cropMissing, setCropMissing] = useState(false);
  // kilka dzialek: razem jako jedno pole (raport) albo kazda osobno (gospodarstwo, I2)
  const canSeparate = parcelIds.length > 1 && !area?.obszar;
  const [separate, setSeparate] = useState(false);
  const [dateError, setDateError] = useState<AnalysisDateError | null>(null);
  const bounds = today ? analysisDateBounds(today) : null;
  const value = date ?? today ?? '';
  const todayLabel = today
    ? format.dateTime(new Date(`${today}T12:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' })
    : '';
  const minLabel = bounds
    ? format.dateTime(new Date(`${bounds.min}T12:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' })
    : '';

  const chooseCrop = useCallback((next: CropId) => {
    setCropId(next);
    setCropMissing(false);
  }, []);
  const changeDate = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDate(event.currentTarget.value);
    setDateError(null);
  }, []);
  const changeMode = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSeparate(event.currentTarget.value === 'separate'),
    [],
  );
  const resetDate = useCallback(() => {
    setDate(null);
    setDateError(null);
  }, []);
  // "Inny dzien": pole daty dostaje fokus (na telefonie od razu otwiera sie kalendarz systemowy)
  const pickOtherDay = useCallback(() => {
    setDate((current) => current ?? today ?? todayInPoland());
  }, [today]);
  const otherDay = date !== null && date !== today;
  const submit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const chosen = date ?? today ?? todayInPoland();
      const error = validateAnalysisDate(chosen, today ?? todayInPoland());

      setCropMissing(!cropId);
      setDateError(error);

      if (!cropId) {
        formRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();

        return;
      }

      if (error) {
        formRef.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();

        return;
      }

      const search = analysisSearchOf({ parcelIds, cropId, date: chosen, ...area });

      router.push(canSeparate && separate ? routes.farm(search) : routes.report(search));
    },
    [area, canSeparate, cropId, date, parcelIds, router, separate, today],
  );

  return (
    <form
      ref={formRef}
      method="get"
      action={localizePath(canSeparate && separate ? routes.farm() : routes.report(), locale)}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-7"
      data-testid="analysis-form"
    >
      {children}
      {parcelIds.length > 0 && <input type="hidden" name="dzialki" value={parcelIds.join(',')} />}
      {area?.obszar && <input type="hidden" name="obszar" value={area.obszar} />}
      {area?.obszar && area.rodzaj && <input type="hidden" name="rodzaj" value={area.rodzaj} />}
      <div className="flex flex-col gap-2">
        <CropPicker
          name="uprawa"
          value={cropId}
          onChange={chooseCrop}
          invalid={cropMissing}
          errorId={cropErrorId}
        />
        {cropMissing && (
          <p id={cropErrorId} className="text-base font-medium text-destructive">
            {t('cropMissing')}
          </p>
        )}
      </div>
      {canSeparate && (
        <fieldset className="flex flex-col gap-2" data-testid="analysis-mode">
          <legend className="mb-3 text-lg font-medium">
            {t('mode.legend', { count: parcelIds.length })}
          </legend>
          <div className="grid gap-2">
            {(['together', 'separate'] as const).map((mode) => (
              <label
                key={mode}
                className="grid min-h-16 cursor-pointer grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-xl border-2 border-input p-3 has-checked:border-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
              >
                <input
                  type="radio"
                  name="tryb"
                  value={mode}
                  checked={separate === (mode === 'separate')}
                  onChange={changeMode}
                  className="row-span-2 mt-1 size-5 shrink-0 accent-accent"
                />
                <span className="text-base font-medium">{t(`mode.${mode}`)}</span>
                <span className="text-sm text-muted-foreground">{t(`mode.${mode}Hint`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-3 text-lg font-medium">{t('dayLegend')}</legend>
        <label className="flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border-2 border-input px-4 py-2 has-checked:border-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
          <input
            type="radio"
            name={`${ids}-day`}
            checked={!otherDay}
            onChange={resetDate}
            className="size-5 shrink-0 accent-accent"
          />
          {today ? t('todayOption', { date: todayLabel }) : t('today')}
        </label>
        <div className="flex flex-col gap-2 rounded-xl border-2 border-input px-4 py-3 has-checked:border-accent">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
            <input
              type="radio"
              name={`${ids}-day`}
              checked={otherDay}
              onChange={pickOtherDay}
              className="size-5 shrink-0 accent-accent"
            />
            {t('otherDay')}
          </label>
          <label htmlFor={dateId} className="sr-only">
            {t('dateLabel')}
          </label>
          <Input
            id={dateId}
            name="data"
            type="date"
            value={value}
            min={bounds?.min}
            max={bounds?.max}
            onChange={changeDate}
            onFocus={pickOtherDay}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? `${dateErrorId} ${dateHintId}` : dateHintId}
            className="w-full max-w-64"
          />
          {dateError && (
            <p id={dateErrorId} className="text-base font-medium text-destructive">
              {t(`dateErrors.${dateError}`, { min: minLabel })}
            </p>
          )}
          <p id={dateHintId} className="text-sm text-muted-foreground">
            {minLabel ? t('dateHint', { min: minLabel }) : t('submitHint')}
          </p>
        </div>
      </fieldset>
      {/* przycisk przyklejony do dolu przewijanego panelu; ujemny margines = odstep panelu (ParcelCheck: px-5/md:px-7) */}
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-1.5 bg-panel px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mx-7 md:px-7">
        <Button type="submit" variant="accent" size="xl" className="w-full">
          {t('submit')}
          <ArrowRight aria-hidden="true" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">{t('submitHint')}</p>
      </div>
    </form>
  );
}
