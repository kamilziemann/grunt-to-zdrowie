import type { WaterReport } from '@app/contracts';
import { CloudOff } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { isoDay } from '../../utils/report-data';
import { reportExtras } from '../../utils/report-extras';
import { vegetationSummary } from '../../utils/report-summary';
import { ChartCard } from '../chart-card';

const HEIGHT = 100;
const DAY_MS = 86_400_000;

/**
 * "Co widzi satelita?" - wilgotnosc roslin (NDMI) na zdjeciach Sentinel-2 z ostatnich tygodni: kolko = zdjecie
 * uzyte, pusty kwadrat na dole = pominiete, bo chmury zaslonily pole (pokazane wprost, nie ukryte). Pas = zakres
 * z poprzednich lat o tej porze, linia przerywana = mediana. Jedna os: NDMI.
 */
export function VegetationChart({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.vegetation');
  const format = useFormatter();
  const series = reportExtras(report).vegetationSeries;

  if (!series || series.observations.length === 0) return null;
  const { latest, skipped, used } = vegetationSummary(series.observations);
  const range = series.baseline?.ndmi;
  const values = [
    ...series.observations.flatMap((item) => (item.used && item.ndmi !== null ? [item.ndmi] : [])),
    ...(range ? [range.min, range.max] : []),
  ];
  const low = Math.floor((Math.min(0, ...values) - 0.05) * 10) / 10;
  const high = Math.ceil((Math.max(0.3, ...values) + 0.05) * 10) / 10;
  const from = isoDay(series.from).getTime();
  const span = Math.max(DAY_MS, isoDay(series.to).getTime() - from);
  const x = (date: string) => ((isoDay(date).getTime() - from) / span) * 96 + 2;
  const y = (value: number) => HEIGHT - ((value - low) / (high - low)) * HEIGHT;
  const number = (value: number) =>
    format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const day = (date: string) =>
    format.dateTime(isoDay(date), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const position =
    latest && range
      ? latest.ndmi < range.min
        ? 'below'
        : latest.ndmi > range.max
          ? 'above'
          : 'within'
      : null;
  const answer = latest
    ? `${t('answer', { date: day(latest.date), value: number(latest.ndmi) })}${
        position && range && series.baseline
          ? ` ${t(`position.${position}`, { min: number(range.min), max: number(range.max), years: series.baseline.years })}`
          : ''
      }`
    : t('answerNone');
  const usedPoints = series.observations.filter((item) => item.used && item.ndmi !== null);

  return (
    <ChartCard
      title={t('title')}
      answer={answer}
      source={t('source')}
      description={`${answer} ${t('counts', { used, skipped })}`}
      data-testid="chart-vegetation"
    >
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="grid grid-cols-[2.5rem_1fr] gap-2">
          <div className="flex h-40 flex-col justify-between text-right text-sm text-muted-foreground tabular-nums">
            <span>{number(high)}</span>
            <span>{number(low)}</span>
          </div>
          <svg
            viewBox={`0 0 100 ${HEIGHT}`}
            preserveAspectRatio="none"
            className="h-40 w-full overflow-visible"
          >
            {range && (
              <>
                <rect
                  x="0"
                  width="100"
                  y={y(range.max)}
                  height={y(range.min) - y(range.max)}
                  className="fill-viz-grid"
                  opacity="0.55"
                />
                <line
                  x1="0"
                  x2="100"
                  y1={y(range.median)}
                  y2={y(range.median)}
                  className="stroke-muted-foreground"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            <polyline
              points={usedPoints.map((item) => `${x(item.date)},${y(item.ndmi ?? 0)}`).join(' ')}
              className="fill-none stroke-viz-water"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* kropka = odcinek zerowej dlugosci z okraglym koncem - zostaje okragla mimo rozciagnietego rysunku */}
            {usedPoints.map((item) => (
              <line
                key={item.date}
                x1={x(item.date)}
                x2={x(item.date)}
                y1={y(item.ndmi ?? 0)}
                y2={y(item.ndmi ?? 0)}
                className="stroke-viz-water"
                strokeWidth="11"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
        <ol className="ml-12 flex flex-wrap gap-1.5 pt-1">
          {series.observations.map((item) => (
            <li
              key={item.date}
              className={
                item.used
                  ? 'flex items-center gap-1 rounded-full bg-viz-water/15 px-2 py-0.5 text-sm font-medium'
                  : 'flex items-center gap-1 rounded-full border border-dashed border-muted-foreground px-2 py-0.5 text-sm text-muted-foreground'
              }
              data-used={item.used}
            >
              {!item.used && <CloudOff className="size-3.5" />}
              {day(item.date)}
            </li>
          ))}
        </ol>
      </div>
      <p className="text-base text-muted-foreground">
        {t('counts', { used, skipped })}{' '}
        {range && series.baseline ? t('band', { years: series.baseline.years }) : null}
      </p>
    </ChartCard>
  );
}
