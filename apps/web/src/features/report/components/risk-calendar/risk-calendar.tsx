import type { History } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import {
  calendarRows,
  IUNG_PERIODS,
  PERIOD_ENDS,
  periodDroughtCount,
  periodMonths,
  type CalendarCell,
} from '../../utils/report-data';

type PeriodStatus = CalendarCell['status'];
type CellKind = PeriodStatus | 'later';

/**
 * Kolor i znak statusu - nigdy sam kolor (WCAG 1.4.1): susza ma tez wykrzyknik i ukosne paski (czytelne na wydruku
 * czarno-bialym), brak danych znak zapytania i przerywana ramke. Klasy jako literaly (Tailwind skanuje zrodla).
 */
const STATUS_STYLES: Record<CellKind, { cell: string; mark: string }> = {
  drought: {
    cell: 'bg-destructive text-destructive-foreground bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_oklab,var(--color-destructive-foreground)_40%,transparent)_3px_5px)]',
    mark: '!',
  },
  ok: { cell: 'bg-success/30 text-foreground', mark: '' },
  not_monitored: { cell: 'bg-muted text-muted-foreground', mark: '–' },
  missing: { cell: 'border border-dashed border-foreground/40 text-muted-foreground', mark: '?' },
  later: { cell: 'border border-dotted border-border', mark: '' },
};

const LEGEND: readonly PeriodStatus[] = ['drought', 'ok', 'not_monitored', 'missing'];

export interface RiskCalendarProps {
  calendar: History['calendar'];
  /** okres konczacy sie w dniu analizy (rok analizy) - wiersz "ten rok" i wyrozniona kolumna */
  current?: CalendarCell | null;
}

/**
 * Kalendarz suszy (D1): lata x okresy 60-dniowe IUNG, kolumny podpisane dniem konca okresu i zgrupowane po
 * miesiacach, ostatni wiersz = rok analizy z jedynym znanym okresem, kolumna tego okresu wyrozniona ("ten rok na
 * tle 10 lat"). Tabela, wiec czytnik ekranu podaje rok, okres i status kazdej kratki. Na telefonie przewija sie
 * w poziomie we wlasnym kontenerze (rok przyklejony z lewej), strona nie; na wydruku miesci sie na szerokosc.
 */
export function RiskCalendar({ calendar, current = null }: RiskCalendarProps) {
  const t = useTranslations('report.history');
  const format = useFormatter();
  const rows = calendarRows(calendar, current);
  const months = periodMonths();
  const currentNo = current?.periodNo ?? null;
  const endLabel = (periodNo: number) => {
    const [month = 1, day = 1] = PERIOD_ENDS[periodNo - 1] ?? [];

    return format.dateTime(new Date(Date.UTC(2024, month - 1, day)), {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  };
  const count = currentNo === null ? null : periodDroughtCount(calendar, currentNo);

  return (
    <figure
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 print:break-inside-avoid"
      data-testid="risk-calendar"
    >
      <figcaption className="flex flex-col gap-1">
        <span className="text-base font-semibold">{t('calendar')}</span>
        {count && currentNo !== null && count.years > 0 && (
          <span className="text-sm">
            {t('currentPeriod', { date: endLabel(currentNo), drought: count.drought, years: count.years })}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{t('calendarDescription')}</span>
      </figcaption>
      {/* `relative` trzyma ukryte etykiety sr-only w srodku kontenera - inaczej rozpychaja strone w poziomie */}
      <section
        className="relative -mx-1 overflow-x-auto px-1 pb-1 [contain:inline-size] focus-visible:outline-2 focus-visible:outline-ring print:mx-0 print:overflow-visible print:px-0"
        aria-label={t('regionLabel')}
      >
        <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-0.5 text-xs print:min-w-0">
          <caption className="sr-only">{t('calendar')}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 w-16 bg-card">
                <span className="sr-only">{t('monthOfEnd')}</span>
              </th>
              {months.map((group) => (
                <th
                  key={group.month}
                  scope="colgroup"
                  colSpan={group.periods.length}
                  className="border-b text-center font-medium capitalize"
                >
                  {format.dateTime(new Date(Date.UTC(2024, group.month - 1, 15)), {
                    month: 'long',
                    timeZone: 'UTC',
                  })}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="col" className="sticky left-0 bg-card text-left font-medium">
                {t('year')}
              </th>
              {Array.from({ length: IUNG_PERIODS }, (_, index) => index + 1).map((periodNo) => (
                <th
                  key={periodNo}
                  scope="col"
                  className={cn(
                    'rounded-sm text-center font-normal text-muted-foreground tabular-nums',
                    periodNo === currentNo && 'bg-water/15 font-semibold text-foreground',
                  )}
                >
                  <span aria-hidden="true">{PERIOD_ENDS[periodNo - 1]?.[1]}</span>
                  <span className="sr-only">{t('periodEnd', { date: endLabel(periodNo) })}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} data-year={row.year} data-current={row.current || undefined}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 bg-card text-left font-medium whitespace-nowrap tabular-nums',
                    row.current && 'font-bold',
                  )}
                >
                  {row.current ? t('currentYear', { year: row.year }) : row.year}
                </th>
                {row.cells.map((cell, index) => {
                  const periodNo = index + 1;
                  const kind: CellKind = cell?.status ?? (row.current ? 'later' : 'missing');
                  const style = STATUS_STYLES[kind];

                  return (
                    <td
                      key={periodNo}
                      className={cn('p-0', periodNo === currentNo && 'bg-water/15')}
                      data-status={kind}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-6 items-center justify-center rounded-sm font-bold print:h-5 print:border print:border-foreground/40',
                          style.cell,
                          row.current && cell && 'ring-2 ring-foreground ring-offset-1 ring-offset-card',
                        )}
                      >
                        {style.mark}
                      </span>
                      <span className="sr-only">{t(`status.${kind}`)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted-foreground sm:hidden print:hidden">{t('scrollHint')}</p>
      <ul aria-label={t('legend')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 items-center justify-center rounded-sm font-bold',
                STATUS_STYLES[status].cell,
              )}
            >
              {STATUS_STYLES[status].mark}
            </span>
            {t(`status.${status}`)}
          </li>
        ))}
      </ul>
    </figure>
  );
}
