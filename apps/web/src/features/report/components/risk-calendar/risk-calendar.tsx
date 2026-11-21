import type { History } from '@app/contracts';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { calendarRows, IUNG_PERIODS } from '../../utils/report-data';

type PeriodStatus = History['calendar'][number]['status'];

/** Kolor i znak statusu (nie tylko kolor - WCAG 1.4.1); klasy jako literaly. */
const STATUS_STYLES: Record<PeriodStatus, { cell: string; mark: string }> = {
  drought: { cell: 'bg-warning text-warning-foreground', mark: '!' },
  ok: { cell: 'bg-success/25 text-foreground', mark: '' },
  not_monitored: { cell: 'bg-muted text-muted-foreground', mark: '·' },
  missing: { cell: 'border border-dashed border-input text-muted-foreground', mark: '?' },
};

const STATUSES: readonly PeriodStatus[] = ['drought', 'ok', 'not_monitored', 'missing'];
const PERIODS = Array.from({ length: IUNG_PERIODS }, (_, index) => index + 1);

/**
 * Kalendarz ryzyka: rok x okres 60-dniowy IUNG (14 okresow od 21 marca). Tabela, wiec czytnik ekranu podaje rok,
 * okres i status kazdej kratki; na telefonie miesci sie bez przewijania w poziomie (kratki ok. 19 px).
 */
export function RiskCalendar({ calendar }: { calendar: History['calendar'] }) {
  const t = useTranslations('report.history');
  const rows = calendarRows(calendar);

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full table-fixed border-separate border-spacing-0.5 text-xs">
        <caption className="mb-1 text-left text-sm">
          <span className="font-medium">{t('calendar')}</span>
          <span className="block text-muted-foreground">{t('calendarDescription')}</span>
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-10 text-left font-medium">
              {t('year')}
            </th>
            {PERIODS.map((period) => (
              <th
                key={period}
                scope="col"
                className="text-center font-normal text-muted-foreground tabular-nums"
              >
                <span aria-hidden="true">{period}</span>
                <span className="sr-only">{t('period', { no: period })}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <th scope="row" className="text-left font-medium tabular-nums">
                {row.year}
              </th>
              {row.cells.map((cell, index) => {
                const status = cell?.status ?? 'missing';
                const style = STATUS_STYLES[status];

                return (
                  <td key={PERIODS[index]} className="p-0" data-status={status}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-5 items-center justify-center rounded-sm font-bold print:border print:border-foreground/40',
                        style.cell,
                      )}
                    >
                      {style.mark}
                    </span>
                    <span className="sr-only">{t(`status.${status}`)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={t('legend')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STATUSES.map((status) => (
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
    </div>
  );
}
