import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { isoDay } from '../../utils/report-data';
import { reportExtras } from '../../utils/report-extras';
import { rainUseSummary } from '../../utils/report-summary';
import { ChartCard } from '../chart-card';

const HEIGHT = 100;

/**
 * "Ile padalo, a ile wypily rosliny?" - dzien po dniu (ok. 60 dni do daty analizy): niebieskie slupki = deszcz,
 * pomaranczowa linia z kropkami = potrzeby uprawy (Kc x ET0). Jedna os: mm na dobe. Luka w danych pogodowych =
 * brak slupka i znak na osi.
 */
export function RainUseChart({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.rainUse');
  const format = useFormatter();
  const series = reportExtras(report).dailySeries;

  if (!series) return null;
  const summary = rainUseSummary(series);
  const max = Math.max(5, ...series.map((day) => Math.max(day.precipitationMm ?? 0, day.etcMm)));
  const scale = Math.ceil(max / 5) * 5;
  const width = series.length * 10;
  const y = (value: number) => HEIGHT - (value / scale) * HEIGHT;
  const line = series.map((day, index) => `${index * 10 + 5},${y(day.etcMm)}`).join(' ');
  const mm = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const day = (date: string) =>
    format.dateTime(isoDay(date), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const first = series[0];
  const last = series.at(-1);
  const gaps = summary.gaps;
  const answer = `${t(gaps > 0 ? 'answerGaps' : 'answer', {
    days: summary.days,
    rain: mm(summary.rainMm),
    use: mm(summary.useMm),
    gaps,
  })}${summary.dryStreak >= 5 ? ` ${t('dryStreak', { days: summary.dryStreak })}` : ''}`;

  return (
    <ChartCard
      title={t('title')}
      answer={answer}
      source={gaps > 0 ? `${t('source')} ${t('gaps', { days: gaps })}` : t('source')}
      description={answer}
      data-testid="chart-rain-use"
    >
      <div aria-hidden="true" className="flex flex-col gap-1">
        <div className="grid grid-cols-[2.5rem_1fr] gap-2">
          <div className="flex h-44 flex-col justify-between text-right text-sm text-muted-foreground tabular-nums">
            <span>{scale}</span>
            <span>{scale / 2}</span>
            <span>0</span>
          </div>
          <svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="h-44 w-full overflow-visible"
          >
            <line
              x1="0"
              x2={width}
              y1={HEIGHT / 2}
              y2={HEIGHT / 2}
              className="stroke-border"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              x2={width}
              y1={HEIGHT}
              y2={HEIGHT}
              className="stroke-foreground/60"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            {series.map((item, index) => {
              const rain = item.precipitationMm;

              // dzien bez danych o deszczu: pusta, przerywana kolumna na cala wysokosc - luka, a nie zero
              return rain === undefined ? (
                <rect
                  key={item.date}
                  x={index * 10 + 1.5}
                  y="1"
                  width="7"
                  height={HEIGHT - 2}
                  className="fill-muted stroke-muted-foreground"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                  data-gap="true"
                />
              ) : (
                <rect
                  key={item.date}
                  x={index * 10 + 1}
                  y={y(rain)}
                  width="8"
                  height={HEIGHT - y(rain)}
                  className="fill-water"
                />
              );
            })}
            <polyline
              points={line}
              className="fill-none stroke-data-orange-strong"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="ml-12 flex justify-between text-sm text-muted-foreground">
          <span>{first ? day(first.date) : null}</span>
          <span>{last ? day(last.date) : null}</span>
        </div>
      </div>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-2 rounded-sm bg-water" />
          {t('legendRain')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-5 border-t-[3px] border-data-orange-strong" />
          {t('legendUse')}
        </li>
        {gaps > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-3.5 w-2.5 rounded-sm border border-dashed border-muted-foreground bg-muted" />
            {t('legendGap')}
          </li>
        )}
        <li>{t('unit')}</li>
      </ul>
    </ChartCard>
  );
}
