import type { History } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { seasonScale } from '../../utils/report-data';
import { ReportDetails } from '../report-section';
import { RiskCalendar } from '../risk-calendar';

/** Klasy szerokosci paska jako literaly (Tailwind skanuje zrodla): udzial okresow suszy w sezonie co 1/14. */
const BAR_WIDTHS = [
  'w-0',
  'w-1/14',
  'w-2/14',
  'w-3/14',
  'w-4/14',
  'w-5/14',
  'w-6/14',
  'w-7/14',
  'w-8/14',
  'w-9/14',
  'w-10/14',
  'w-11/14',
  'w-12/14',
  'w-13/14',
  'w-full',
] as const;

function barWidth(drought: number, scale: number): string {
  const step = Math.round((drought / scale) * (BAR_WIDTHS.length - 1));

  return BAR_WIDTHS[Math.min(Math.max(step, 0), BAR_WIDTHS.length - 1)] ?? 'w-0';
}

/**
 * Sekcja 2 - historia: zdanie "w X z Y sezonow brakowalo wody", miesiace najwiekszego ryzyka i pasek na kazdy
 * sezon (ile okresow suszy). Kalendarz okresow IUNG (rok x okres) w rozwijanych szczegolach.
 */
export function HistorySection({ history }: { history: History }) {
  const t = useTranslations('report.history');
  const tReport = useTranslations('report');
  const format = useFormatter();
  const scale = seasonScale(history.seasons);
  const seasons = history.seasons.toSorted((a, b) => a.year - b.year);
  const months = history.riskMonths.map((month) =>
    format.dateTime(new Date(Date.UTC(2024, month - 1, 15)), { month: 'long', timeZone: 'UTC' }),
  );

  if (history.seasonsWithData === 0 && seasons.length === 0) {
    return <p className="text-base text-muted-foreground">{t('noData')}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-balance">
        {t('headline', { drought: history.droughtSeasons, seasons: history.seasonsWithData })}
      </p>
      {months.length > 0 && (
        <p className="text-base">
          {t('riskMonths', { months: format.list(months, { type: 'conjunction' }) })}
        </p>
      )}
      {seasons.length > 0 && (
        <figure className="flex flex-col gap-2 rounded-lg border bg-card p-4 print:break-inside-avoid">
          <figcaption className="text-sm text-muted-foreground">{t('chartLabel')}</figcaption>
          <ul className="flex flex-col gap-1.5">
            {seasons.map((season) => {
              const hasData = season.monitoredPeriods > 0;
              const label = hasData
                ? t('season', {
                    year: season.year,
                    drought: season.droughtPeriods,
                    monitored: season.monitoredPeriods,
                  })
                : t('seasonNoData', { year: season.year });

              return (
                <li key={season.year} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-sm">
                  <span className="font-medium tabular-nums" aria-hidden="true">
                    {season.year}
                  </span>
                  <span aria-hidden="true" className="h-4 overflow-hidden rounded-sm bg-muted">
                    <span
                      className={cn(
                        'block h-full rounded-sm print:border print:border-foreground',
                        season.droughtPeriods > 0 ? 'bg-warning' : 'bg-success',
                        season.droughtPeriods > 0 ? barWidth(season.droughtPeriods, scale) : 'w-1',
                      )}
                    />
                  </span>
                  <span className="text-right tabular-nums" aria-hidden="true">
                    {hasData ? season.droughtPeriods : '–'}
                  </span>
                  <span className="sr-only">
                    {label}
                    {season.stressDays !== null ? `, ${t('stressDays', { days: season.stressDays })}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </figure>
      )}
      {history.calendar.length > 0 && (
        <ReportDetails summary={tReport('details')}>
          <RiskCalendar calendar={history.calendar} />
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {seasons.map((season) => (
              <li key={season.year}>
                {season.year}:{' '}
                {[
                  season.minBalanceMm === null
                    ? null
                    : t('minBalance', {
                        balance: format.number(season.minBalanceMm, { maximumFractionDigits: 1 }),
                      }),
                  season.stressDays === null ? null : t('stressDays', { days: season.stressDays }),
                ]
                  .filter(Boolean)
                  .join(', ') || '–'}
              </li>
            ))}
          </ul>
        </ReportDetails>
      )}
    </div>
  );
}
