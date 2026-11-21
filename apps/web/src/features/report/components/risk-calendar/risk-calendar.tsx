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
type CellKind = PeriodStatus | 'excess' | 'later';

/**
 * Kolor i znak statusu - nigdy sam kolor (WCAG 1.4.1): susza ma tez wykrzyknik i ukosne paski (czytelne na wydruku
 * czarno-bialym), nadmiar wody fale i poziome paski, brak danych znak zapytania i przerywana ramke. Klasy jako
 * literaly (Tailwind skanuje zrodla).
 */
const STATUS_STYLES: Record<CellKind, { cell: string; mark: string }> = {
  drought: {
    cell: 'bg-destructive text-destructive-foreground bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_oklab,var(--color-destructive-foreground)_40%,transparent)_3px_5px)]',
    mark: '!',
  },
  excess: {
    cell: 'bg-water/35 text-foreground bg-[repeating-linear-gradient(0deg,transparent_0_3px,color-mix(in_oklab,var(--color-water)_45%,transparent)_3px_4px)]',
    mark: '≈',
  },
  ok: { cell: 'bg-success/30 text-foreground', mark: '' },
  not_monitored: { cell: 'bg-muted text-muted-foreground', mark: '–' },
  missing: { cell: 'border border-dashed border-foreground/40 text-muted-foreground', mark: '?' },
  later: { cell: 'border border-dotted border-border', mark: '' },
};

const NO_CELLS: readonly CalendarCell[] = [];

const LEGEND: readonly CellKind[] = ['drought', 'excess', 'ok', 'not_monitored', 'missing'];

/** Nadmiar wody (KBW > +50 mm) wazy wiecej niz "w normie" i "nie oceniano"; susza i brak danych zostaja soba. */
function cellKind(cell: CalendarCell | null, current: boolean): CellKind {
  if (!cell) return current ? 'later' : 'missing';

  if (cell.excess && (cell.status === 'ok' || cell.status === 'not_monitored')) return 'excess';

  return cell.status;
}

export interface RiskCalendarProps {
  calendar: History['calendar'];
  /** okres konczacy sie w dniu analizy (rok analizy) - wiersz "ten rok" i wyrozniona kolumna */
  current?: CalendarCell | null;
  /** okresy roku analizy, ktore juz sie skonczyly (`history.currentCalendar`) */
  currentYear?: readonly CalendarCell[];
}

/**
 * Kalendarz suszy (D1): lata x okresy 60-dniowe IUNG, kolumny podpisane dniem konca okresu i zgrupowane po
 * miesiacach, ostatni wiersz = rok analizy (okresy zakonczone do dnia analizy), kolumna okresu z oceny wyrozniona
 * ("ten rok na tle 10 lat"); nadmiar wody ma wlasny stan. Tabela, wiec czytnik ekranu podaje rok, okres i status kazdej kratki. Na telefonie przewija sie
 * w poziomie we wlasnym kontenerze (rok przyklejony z lewej), strona nie; na wydruku miesci sie na szerokosc.
 */
export function RiskCalendar({ calendar, current = null, currentYear = NO_CELLS }: RiskCalendarProps) {
  const t = useTranslations('report.history');
  const format = useFormatter();
  const rows = calendarRows(calendar, current, currentYear);
  const legend = LEGEND.filter(
    (kind) =>
      kind !== 'excess' ||
      rows.some((row) => row.cells.some((cell) => cellKind(cell, row.current) === 'excess')),
  );
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
                  const kind = cellKind(cell, row.current);
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
                          row.current &&
                            cell &&
                            periodNo === currentNo &&
                            'ring-2 ring-foreground ring-offset-1 ring-offset-card',
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
        {legend.map((status) => (
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
