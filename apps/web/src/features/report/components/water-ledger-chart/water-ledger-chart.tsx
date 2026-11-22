import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { isoDay } from '../../utils/report-data';
import { reportExtras } from '../../utils/report-extras';
import { ledgerRatio } from '../../utils/report-summary';
import { ChartCard } from '../chart-card';

type RowKind = 'storage' | 'rain' | 'use' | 'lost' | 'shortfall';

/** Wypelnienie paska: kolor i wzor (czytelne na wydruku czarno-bialym). */
const BAR: Record<RowKind, string> = {
  storage: 'fill-data-blue-light',
  rain: 'fill-water',
  use: 'fill-data-orange',
  lost: 'fill-data-sand',
  shortfall: 'fill-transparent stroke-data-orange-dark',
};

interface LedgerRow {
  id: string;
  kind: RowKind;
  label: string;
  value: number;
  sign: '' | '+' | '−';
}

/**
 * "Gdzie podziala sie woda od wiosny?" - rachunek wody w strefie korzeni: zapas na poczatku, deszcz, zuzycie
 * przez rosliny i slonce, przesiakanie ponizej korzeni, zapas na koncu; osobno - ile wody zabraklo uprawie. Jedna os
 * (mm = litry na m2), paski poziome (czytelne na telefonie). Model nie liczy splywu po powierzchni.
 */
export function WaterLedgerChart({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.ledger');
  const format = useFormatter();
  const ledger = reportExtras(report).waterLedger;

  if (!ledger) return null;
  const mm = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const day = (date: string) =>
    format.dateTime(isoDay(date), { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const rows: LedgerRow[] = [
    {
      id: 'start',
      kind: 'storage',
      label: t('start', { date: day(ledger.from) }),
      value: ledger.startStorageMm,
      sign: '',
    },
    { id: 'rain', kind: 'rain', label: t('rain'), value: ledger.precipitationMm, sign: '+' },
    { id: 'use', kind: 'use', label: t('use'), value: ledger.cropUseMm, sign: '−' },
    { id: 'lost', kind: 'lost', label: t('lost'), value: ledger.lostBelowRootsMm, sign: '−' },
    {
      id: 'end',
      kind: 'storage',
      label: t('end', { date: day(ledger.to) }),
      value: ledger.endStorageMm,
      sign: '',
    },
  ];
  const shown = rows.filter((row) => row.kind !== 'lost' || row.value >= 0.5);
  const scale = Math.max(1, ...rows.map((row) => row.value), ledger.shortfallMm);
  const ratio = ledgerRatio(ledger);
  const answer =
    ratio === null
      ? t('answerNoRain', { use: mm(ledger.cropUseMm) })
      : ratio >= 1.2
        ? t('answerMore', { ratio: format.number(ratio, { maximumFractionDigits: 1 }) })
        : ratio <= 0.8
          ? t('answerLess')
          : t('answerEven');
  const description = [
    ...shown,
    { id: 'shortfall', kind: 'shortfall', label: t('shortfall'), value: ledger.shortfallMm, sign: '' },
  ]
    .map((row) => `${row.label}: ${row.sign}${mm(row.value)} l/m²`)
    .join('; ');

  return (
    <ChartCard
      title={t('title')}
      answer={answer}
      source={
        ledger.missingWeatherDays
          ? `${t('source')} ${t('missingDays', { days: ledger.missingWeatherDays })}`
          : t('source')
      }
      description={description}
      data-testid="chart-ledger"
    >
      <ul aria-hidden="true" className="flex flex-col gap-2.5">
        {shown.map((row) => (
          <li key={row.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
            <span className="text-base leading-tight">{row.label}</span>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-6 w-full">
              <rect
                x="0"
                y="0"
                width={(row.value / scale) * 100}
                height="10"
                rx="1.5"
                className={BAR[row.kind]}
              />
              {row.kind === 'lost' && (
                <rect
                  x="0"
                  y="0"
                  width={(row.value / scale) * 100}
                  height="10"
                  className="fill-none stroke-data-orange-strong"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            <span
              className={cn(
                'text-right text-lg font-semibold tabular-nums',
                row.kind === 'use' && 'text-warning',
              )}
            >
              {row.sign}
              {mm(row.value)}
            </span>
          </li>
        ))}
        {ledger.shortfallMm >= 1 && (
          <li className="mt-1 grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 border-t border-dashed pt-3">
            <span className="text-base leading-tight font-medium">{t('shortfall')}</span>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-6 w-full">
              <rect
                x="0.5"
                y="0.5"
                width={Math.max(0, (ledger.shortfallMm / scale) * 100 - 1)}
                height="9"
                className="fill-none stroke-data-orange-dark"
                strokeWidth="2"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="text-right text-lg font-semibold text-warning tabular-nums">
              {mm(ledger.shortfallMm)}
            </span>
          </li>
        )}
      </ul>
      <p className="text-base text-muted-foreground">{t('unit')}</p>
    </ChartCard>
  );
}
