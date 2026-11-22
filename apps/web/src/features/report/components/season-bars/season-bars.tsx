import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { drySeasons, riskMonthRange, seasonBars } from '../../utils/report-summary';
import { ChartCard } from '../chart-card';

const MIN_SCALE_DAYS = 20;

/**
 * "Jak bylo przez 10 lat?" - slupek na sezon: dni z niedoborem wody wg bilansu strefy korzeni (jedna os). Sezon
 * z susza rolnicza wg progow IUNG ma ciemniejszy slupek i znak "!", biezacy (do dnia analizy) - niebieska ramke
 * i podpis, brak danych - przerywany kontur ze znakiem "?". Pod spodem miesiace, w ktorych brakuje wody najczesciej.
 */
export function SeasonBars({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.seasons');
  const format = useFormatter();
  const bars = seasonBars(report);
  const summary = drySeasons(report);

  if (bars.length === 0 || !summary) return null;
  const scale = Math.max(MIN_SCALE_DAYS, ...bars.map((bar) => bar.stressDays ?? 0));
  const range = riskMonthRange(report.history.riskMonths);
  const month = (value: number) =>
    format.dateTime(new Date(Date.UTC(2024, value - 1, 1)), { month: 'long', timeZone: 'UTC' });
  const months =
    range === null
      ? null
      : range[0] === range[1]
        ? month(range[0])
        : `${month(range[0])} – ${month(range[1])}`;
  const answer = months
    ? t('answerMonths', { dry: summary.dry, total: summary.total, months })
    : t('answer', { dry: summary.dry, total: summary.total });

  return (
    <ChartCard
      title={t('title')}
      answer={answer}
      source={t('source')}
      description={bars
        .map((bar) =>
          bar.stressDays === null
            ? t('barMissing', { year: bar.year })
            : t('barDescription', {
                year: bar.year,
                days: bar.stressDays,
                drought: bar.drought ? 'yes' : 'no',
              }),
        )
        .join('; ')}
      data-testid="chart-seasons"
    >
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-4xl leading-none font-bold tabular-nums">{t('headline', summary)}</span>
        <span className="text-lg">{t('headlineNote')}</span>
      </p>
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="relative grid h-40 grid-rows-1 auto-cols-fr grid-flow-col items-end gap-1 border-b-2 border-foreground/60">
          {bars.map((bar) => (
            <div
              key={bar.year}
              className="flex h-full min-w-0 flex-col items-center justify-end gap-0.5"
              data-season-bar={bar.year}
            >
              <span
                className={cn('text-sm leading-none font-bold tabular-nums', bar.drought && 'text-warning')}
              >
                {bar.stressDays === null ? '?' : bar.drought ? `${bar.stressDays}!` : bar.stressDays}
              </span>
              <svg
                viewBox="0 0 10 100"
                preserveAspectRatio="none"
                className="h-[calc(100%-1.25rem)] w-full max-w-9"
              >
                <defs>
                  <pattern
                    id={`season-hatch-${bar.year}`}
                    width="4"
                    height="4"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="4" height="4" className="fill-data-orange-dark" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="4"
                      className="stroke-background"
                      strokeWidth="1"
                      opacity="0.5"
                    />
                  </pattern>
                </defs>
                {bar.stressDays === null ? (
                  <rect
                    x="0.5"
                    y="80"
                    width="9"
                    height="20"
                    className="fill-none stroke-muted-foreground"
                    strokeDasharray="2 2"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <rect
                    x="0"
                    y={100 - (bar.stressDays / scale) * 100}
                    width="10"
                    height={(bar.stressDays / scale) * 100}
                    rx="1"
                    fill={bar.drought ? `url(#season-hatch-${bar.year})` : undefined}
                    className={cn(
                      !bar.drought && (bar.current ? 'fill-water' : 'fill-data-orange'),
                      bar.current && 'stroke-water',
                    )}
                    strokeWidth={bar.current ? 2 : 0}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </div>
          ))}
        </div>
        <div className="grid auto-cols-fr grid-flow-col gap-1">
          {bars.map((bar) => (
            <span
              key={bar.year}
              className={cn(
                'text-center text-sm leading-tight tabular-nums',
                bar.current && 'font-bold text-water',
              )}
            >
              <span className="sm:hidden">{`’${String(bar.year).slice(2)}`}</span>
              <span className="max-sm:hidden">{bar.year}</span>
            </span>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-data-orange" />
          {t('legendDays')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-data-orange-dark" />
          {t('legendDrought')}
        </li>
        {bars.some((bar) => bar.current) && (
          <li className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-sm bg-water" />
            {t('legendCurrent')}
          </li>
        )}
      </ul>
    </ChartCard>
  );
}
