import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { romanCategory } from '../../utils/report-data';
import { reportExtras } from '../../utils/report-extras';
import { findEvidence, rainUseSummary, vegetationSummary } from '../../utils/report-summary';

interface KeyNumber {
  id: string;
  label: string;
  value: string;
  /** odniesienie: prog, norma, historia pola */
  reference: string;
  /** wartosc po zlej stronie odniesienia - pomaranczowa liczba (i slowo w odniesieniu) */
  alarm: boolean;
}

/**
 * Pelna analiza zaczyna sie od liczb z odniesieniem (dla doradcy): bilans wg metody IUNG i prog, deszcz na tle
 * normy, wilgotnosc roslin na tle lat, dni bez deszczu, dni upalu. Kafel bez danych znika; bez zadnego - nic.
 */
export function KeyNumbers({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.numbers');
  const format = useFormatter();
  const { climaticBalance: balance, precipitation, vegetation } = report.assessment;
  const extras = reportExtras(report);
  const mm = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const index = (value: number) =>
    format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const items: KeyNumber[] = [];

  if (balance?.balanceMm !== null && balance?.balanceMm !== undefined) {
    items.push({
      id: 'balance',
      label: t('balance'),
      value: t('mm', { value: mm(balance.balanceMm) }),
      reference:
        balance.thresholdMm !== null && balance.soilCategory !== null
          ? t('balanceThreshold', {
              threshold: mm(balance.thresholdMm),
              category: romanCategory(balance.soilCategory),
              below: balance.belowThreshold ? 'yes' : 'no',
            })
          : t('balanceNoThreshold'),
      alarm: balance.belowThreshold === true,
    });
  }

  if (precipitation) {
    const percent =
      precipitation.medianMm > 0 ? Math.round((precipitation.sumMm / precipitation.medianMm) * 100) : null;

    items.push({
      id: 'rain',
      label: t('rain', { days: precipitation.days }),
      value: t('mm', { value: mm(precipitation.sumMm) }),
      reference:
        percent === null
          ? t('rainMedian', { median: mm(precipitation.medianMm) })
          : t('rainPercent', { median: mm(precipitation.medianMm), percent }),
      alarm: percent !== null && percent < 70,
    });
  }

  const series = extras.vegetationSeries;
  const latest = series ? vegetationSummary(series.observations).latest : null;
  const range = series?.baseline?.ndmi;

  if (latest && range && series?.baseline) {
    items.push({
      id: 'ndmi',
      label: t('ndmi'),
      value: index(latest.ndmi),
      reference: t('ndmiRange', {
        min: index(range.min),
        max: index(range.max),
        years: series.baseline.years,
      }),
      alarm: latest.ndmi < range.min,
    });
  } else if (vegetation?.ndmi !== null && vegetation?.ndmi !== undefined) {
    items.push({
      id: 'ndmi',
      label: t('ndmi'),
      value: index(vegetation.ndmi),
      reference:
        vegetation.ndmiAnomaly === null
          ? t('ndmiNoBaseline')
          : t('ndmiAnomaly', { anomaly: index(vegetation.ndmiAnomaly), years: vegetation.baselineYears }),
      alarm: (vegetation.ndmiAnomaly ?? 0) < -0.05,
    });
  }

  if (extras.dailySeries) {
    const summary = rainUseSummary(extras.dailySeries);
    const rainy = extras.dailySeries.filter((day) => (day.precipitationMm ?? 0) >= 1).length;

    items.push({
      id: 'dry',
      label: t('dryDays'),
      value: t('days', { days: summary.dryStreak }),
      reference: t('dryReference', { rainy, days: summary.days }),
      alarm: summary.dryStreak >= 10,
    });
  }

  const hot = findEvidence(report, 'hot_days_30d') ?? findEvidence(report, 'hot_days_14d');
  const hotNormal = findEvidence(report, 'hot_days_30d_normal')?.value ?? hot?.reference;

  if (hot) {
    items.push({
      id: 'heat',
      label: t('heat', { window: hot.metric === 'hot_days_14d' ? 14 : 30 }),
      value: t('days', { days: Math.round(hot.value) }),
      reference:
        hotNormal === undefined
          ? t('heatNoNormal')
          : t('heatNormal', { normal: format.number(hotNormal, { maximumFractionDigits: 1 }) }),
      alarm: hotNormal !== undefined && hot.value >= 2 * hotNormal && hot.value >= 5,
    });
  }

  if (items.length === 0) return null;

  return (
    <dl
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 print:grid-cols-3 print:gap-2"
      data-testid="key-numbers"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-1 rounded-2xl border bg-card p-4 print:break-inside-avoid print:p-3"
          data-number={item.id}
        >
          <dt className="text-base text-muted-foreground">{item.label}</dt>
          <dd className={cn('text-3xl font-bold tabular-nums', item.alarm && 'text-warning')}>
            {item.value}
          </dd>
          <dd className="text-base leading-snug">{item.reference}</dd>
        </div>
      ))}
    </dl>
  );
}
