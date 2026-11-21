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
 * Drugi krok: uprawa i dzien analizy, potem raport. Bez JavaScriptu formularz wysyla GET na `/raport` (te same
 * nazwy pol co parametry adresu); z JavaScriptem sprawdza pola i przechodzi bez przeladowania. Przycisk "Analizuj"
 * jest przyklejony do dolu ekranu, wiec na telefonie zawsze go widac.
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
  const [dateError, setDateError] = useState<AnalysisDateError | null>(null);
  const bounds = today ? analysisDateBounds(today) : null;
  const value = date ?? today ?? '';
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
  const resetDate = useCallback(() => {
    setDate(null);
    setDateError(null);
  }, []);
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

      router.push(routes.report(analysisSearchOf({ parcelIds, cropId, date: chosen, ...area })));
    },
    [area, cropId, date, parcelIds, router, today],
  );

  return (
    <form
      ref={formRef}
      method="get"
      action={localizePath(routes.report(), locale)}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-section"
      data-testid="analysis-form"
    >
      {children}
      {parcelIds.length > 0 && <input type="hidden" name="dzialki" value={parcelIds.join(',')} />}
      {area?.obszar && <input type="hidden" name="obszar" value={area.obszar} />}
      {area?.obszar && area.rodzaj && <input type="hidden" name="rodzaj" value={area.rodzaj} />}
      <section
        aria-labelledby={`${ids}-title`}
        className="flex flex-col gap-6 rounded-xl border bg-card p-4 sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id={`${ids}-title`} className="text-2xl font-semibold">
            {t('title')}
          </h2>
          <p className="text-base text-muted-foreground">{t('description')}</p>
        </div>
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
        <div className="flex flex-col gap-2">
          <label htmlFor={dateId} className="text-lg font-semibold">
            {t('dateLabel')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={dateId}
              name="data"
              type="date"
              value={value}
              min={bounds?.min}
              max={bounds?.max}
              onChange={changeDate}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? `${dateErrorId} ${dateHintId}` : dateHintId}
              className="h-12 w-auto min-w-48 text-base"
            />
            {date !== null && date !== today && (
              <Button variant="outline" size="xl" onClick={resetDate}>
                {t('today')}
              </Button>
            )}
          </div>
          {dateError && (
            <p id={dateErrorId} className="text-base font-medium text-destructive">
              {t(`dateErrors.${dateError}`, { min: minLabel })}
            </p>
          )}
          <p id={dateHintId} className="text-sm text-muted-foreground">
            {minLabel ? t('dateHint', { min: minLabel }) : t('submitHint')}
          </p>
        </div>
      </section>
      <div className="sticky bottom-0 z-10 -mx-gutter flex flex-col gap-2 border-t bg-background/95 px-gutter pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:items-center sm:gap-4">
        <Button type="submit" size="xl" className="w-full sm:w-auto sm:min-w-56">
          {t('submit')}
          <ArrowRight aria-hidden="true" />
        </Button>
        <p className="text-center text-sm text-muted-foreground sm:text-left">{t('submitHint')}</p>
      </div>
    </form>
  );
}
