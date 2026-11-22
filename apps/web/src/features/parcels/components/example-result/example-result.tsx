import { ArrowRight, Check } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';

import { EXAMPLE_REPORTS } from '../example-reports';
import { ShowcaseSketch } from './showcase-sketch';

/**
 * Liczby z prawdziwego raportu przykladu `ditch` (Chwalim 349/1, `080904_5.0001.349/1`, pszenica ozima, dzien
 * 15.06.2018), przepisane 2026-11-22 z lokalnej analizy (silnik 0.8.0, raport `r-524fa86a`), widok "Prosto":
 * "Bardzo sucho", brakuje ok. 105 l/m2 wody, zbiornik w glebie pelny w 11 %, wody brakowalo w 9 z 10 sezonow,
 * pierwsze zalecenie: zastawka na rowie (`ditch_weir`). Nowa wersja silnika moze zmienic wynik - wtedy przepisz
 * liczby z raportu (link karty prowadzi do tego samego raportu).
 */
export const SHOWCASE = {
  label: '349/1 · Chwalim',
  areaHa: 19.35,
  date: '2018-06-15',
  missingMm: 105,
  tankPct: 11,
  drySeasons: 9,
  seasons: 10,
} as const;

const DONE_STEPS = ['find', 'check'] as const;

/**
 * "Przyklad wyniku" pod polem numeru (makieta: okno z ciemnym panelem i mapa dzialki): pasek krokow, dzialka,
 * werdykt, "Teraz", "10 lat", "Co najpierw" i szkic pola. Cala karta prowadzi do tego raportu.
 */
export function ExampleResult() {
  const t = useTranslations('parcels.home.showcase');
  const format = useFormatter();
  const date = format.dateTime(new Date(`${SHOWCASE.date}T12:00:00Z`), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <Link
      href={EXAMPLE_REPORTS.ditch}
      className="group relative flex w-full max-w-page flex-col overflow-hidden rounded-t-3xl border border-b-0 border-secondary-border bg-card shadow-showcase md:h-[27.5rem] md:flex-row"
      data-testid="example-result"
    >
      <span className="absolute top-3.5 right-3.5 z-10 rounded-full border border-input/40 bg-card px-3 py-1 text-sm font-medium text-foreground">
        {t('badge')}
      </span>
      <span className="flex flex-col gap-3 surface-panel p-5 pt-16 md:w-[23rem] md:shrink-0 md:p-6">
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span className="sr-only">{t('steps')}:</span>
          {DONE_STEPS.map((key) => (
            <span key={key} className="flex items-center gap-1">
              <Check aria-hidden="true" className="size-4" strokeWidth={2.6} />
              {t(key)}
              <span aria-hidden="true"> —</span>
            </span>
          ))}
          <span className="font-medium text-foreground">3 {t('analyze')}</span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-2xl font-medium tracking-tight">
            {t('parcel', { label: SHOWCASE.label })}
          </span>
          <span className="text-sm text-muted-foreground">
            {t('place', { area: format.number(SHOWCASE.areaHa, { maximumFractionDigits: 2 }), date })}
          </span>
        </span>
        <span className="flex w-fit items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 font-medium text-warning">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-warning" />
          {t('verdict')}
        </span>
        <span className="flex flex-col gap-1.5">
          <span>
            <span className="text-muted-foreground">{t('nowLabel')}</span>{' '}
            {t('now', { mm: SHOWCASE.missingMm, percent: SHOWCASE.tankPct })}
          </span>
          <span>
            <span className="text-muted-foreground">{t('historyLabel')}</span>{' '}
            {t('history', { dry: SHOWCASE.drySeasons, seasons: SHOWCASE.seasons })}
          </span>
          <span>
            <span className="text-muted-foreground">{t('firstLabel')}</span> {t('first')}
          </span>
        </span>
        <span className="mt-auto flex items-center gap-2 pt-2 font-medium underline underline-offset-4">
          {t('open')}
          <ArrowRight aria-hidden="true" className="size-5 transition-transform group-hover:translate-x-1" />
        </span>
      </span>
      <span className="relative block h-56 bg-muted md:h-auto md:flex-1">
        <ShowcaseSketch label={t('sketch')} />
      </span>
    </Link>
  );
}
