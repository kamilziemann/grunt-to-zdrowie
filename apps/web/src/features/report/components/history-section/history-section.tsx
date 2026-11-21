import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import {
  currentPeriod,
  excessSeasons,
  isoDay,
  rankSide,
  seasonRows,
  stressSummary,
} from '../../utils/report-data';
import { ReportDetails } from '../report-section';
import { RiskCalendar } from '../risk-calendar';

/** Klasy szerokosci paska jako literaly (Tailwind skanuje zrodla): co 1/14 skali. */
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

function barWidth(value: number, scale: number): string {
  const step = Math.round((value / scale) * (BAR_WIDTHS.length - 1));

  return BAR_WIDTHS[Math.min(Math.max(step, 0), BAR_WIDTHS.length - 1)] ?? 'w-0';
}

/**
 * Sekcja 2 - historia: w ilu poprzednich sezonach brakowalo wody (bilans gleby albo prog IUNG), ile mialo susze wg
 * progow IUNG i nadmiar wody, jak wypada ten rok (pozycja okresu na tle lat, dni z niedoborem wody od poczatku
 * sezonu na tle calych poprzednich sezonow), miesiace ryzyka, wykres dni stresu na sezon (biezacy wyrozniony)
 * i kalendarz suszy. Sam licznik sezonow z susza IUNG bywa zerem przy
 * werdykcie "susza" - dlatego obok zawsze stoi biezacy sezon.
 */
export function HistorySection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.history');
  const tReport = useTranslations('report');
  const format = useFormatter();
  const { history } = report;
  const rows = seasonRows(report);
  const previous = rows.filter((row) => !row.current);
  const current = rows.find((row) => row.current) ?? null;
  const summary = stressSummary(rows);
  const scale = Math.max(1, ...rows.map((row) => row.stressDays ?? 0));
  const balance = report.assessment.climaticBalance;
  const rank = balance?.rankInHistory;
  const shortDay = (date: string) =>
    format.dateTime(isoDay(date), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const analysisDay = shortDay(report.meta.analysisDate);
  const months = history.riskMonths.map((month) =>
    format.dateTime(new Date(Date.UTC(2024, month - 1, 15)), { month: 'long', timeZone: 'UTC' }),
  );
  const number = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  const excess = excessSeasons(history.calendar);

  if (history.seasonsWithData === 0 && rows.length === 0) {
    return <p className="text-base text-muted-foreground">{t('noData')}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" data-testid="history-summary">
        {history.deficitSeasons === undefined ? (
          <p className="text-lg font-semibold text-balance">
            {t('previous', { drought: history.droughtSeasons, seasons: history.seasonsWithData })}
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold text-balance" data-testid="deficit-seasons">
              {t('deficit', { deficit: history.deficitSeasons, seasons: history.seasonsWithData })}
            </p>
            <p className="text-base">
              {t('previous', { drought: history.droughtSeasons, seasons: history.seasonsWithData })}
            </p>
          </>
        )}
        {excess > 0 && (
          <p className="text-base" data-testid="excess-seasons">
            {t('excessSeasons', { count: excess, seasons: history.seasonsWithData })}
          </p>
        )}
        {rank && balance && balance.periodNo !== null && (
          <p className="text-base">
            {t('current', {
              year: Number(report.meta.analysisDate.slice(0, 4)),
              date: shortDay(balance.periodTo),
              ...rankSide(rank.rank, rank.years),
              years: rank.years,
            })}
          </p>
        )}
        {current?.stressDays !== null && current && summary && (
          <p className="text-base">
            {t('currentStress', {
              days: current.stressDays ?? 0,
              date: analysisDay,
              average: summary.average,
              max: summary.max,
              maxYear: summary.maxYear,
            })}
          </p>
        )}
        {months.length > 0 && (
          <p className="text-base">
            {t('riskMonths', { months: format.list(months, { type: 'conjunction' }) })}
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <figure className="flex flex-col gap-2 rounded-lg border bg-card p-4 print:break-inside-avoid">
          <figcaption className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t('chartLabel')}</span>
            <span className="text-xs text-muted-foreground">{t('chartNote')}</span>
          </figcaption>
          <ul className="flex flex-col gap-1.5">
            {rows.map((row) => {
              const label =
                row.stressDays === null
                  ? t('seasonNoData', { year: row.year })
                  : t('seasonStress', {
                      year: row.current
                        ? t('seasonCurrent', { year: row.year, date: analysisDay })
                        : row.year,
                      days: row.stressDays,
                    });
              const extra = [
                row.droughtPeriods > 0 ? t('droughtPeriods', { count: row.droughtPeriods }) : null,
                row.etDeficitMm === null ? null : t('etDeficit', { mm: number(row.etDeficitMm) }),
              ].filter((item): item is string => item !== null);

              return (
                <li
                  key={row.year}
                  className={cn(
                    'grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 rounded-sm text-sm',
                    row.current && 'bg-water/10 py-1 font-semibold ring-1 ring-water',
                  )}
                  data-season={row.year}
                  data-current={row.current || undefined}
                >
                  <span aria-hidden="true" className="flex flex-col pl-1 leading-tight tabular-nums">
                    <span className="flex items-center gap-1">
                      {row.year}
                      {row.droughtPeriods > 0 && (
                        <span className="flex size-4 items-center justify-center rounded-sm bg-destructive text-[0.65rem] font-bold text-destructive-foreground">
                          !
                        </span>
                      )}
                    </span>
                    {row.current && <span className="text-xs font-normal">{analysisDay}</span>}
                  </span>
                  <span aria-hidden="true" className="h-4 overflow-hidden rounded-sm bg-muted">
                    <span
                      className={cn(
                        'block h-full rounded-sm print:border print:border-foreground',
                        row.current ? 'bg-water' : 'bg-warning',
                        row.stressDays ? barWidth(row.stressDays, scale) : 'w-0',
                      )}
                    />
                  </span>
                  <span className="pr-1 text-right tabular-nums" aria-hidden="true">
                    {row.stressDays ?? '–'}
                  </span>
                  <span className="sr-only">{[label, ...extra].join(', ')}</span>
                </li>
              );
            })}
          </ul>
        </figure>
      )}

      {history.calendar.length > 0 && (
        <RiskCalendar
          calendar={history.calendar}
          current={currentPeriod(report)}
          currentYear={history.currentCalendar}
        />
      )}

      {previous.length > 0 && (
        <ReportDetails summary={tReport('details')}>
          {history.deficitSeasons !== undefined && (
            <p className="text-muted-foreground">{t('deficitNote')}</p>
          )}
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {history.seasons
              .toSorted((a, b) => a.year - b.year)
              .map((season) => (
                <li key={season.year}>
                  {season.year}:{' '}
                  {[
                    season.minBalanceMm === null
                      ? null
                      : t('minBalance', {
                          balance: format.number(season.minBalanceMm, { maximumFractionDigits: 1 }),
                        }),
                    season.stressDays === null ? null : t('stressDays', { days: season.stressDays }),
                    season.etDeficitMm === undefined || season.etDeficitMm === null
                      ? null
                      : t('etDeficit', { mm: number(season.etDeficitMm) }),
                    season.droughtPeriods > 0 ? t('droughtPeriods', { count: season.droughtPeriods }) : null,
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
