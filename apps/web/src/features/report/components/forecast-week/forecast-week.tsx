import type { WaterReport } from '@app/contracts';
import { CloudRain, Sun } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { isoDay } from '../../utils/report-data';
import { reportExtras, waterTank } from '../../utils/report-extras';
import { forecastSummary, RAIN_DAY_MM } from '../../utils/report-summary';
import { ChartCard } from '../chart-card';

/** Skala slupkow deszczu: co najmniej 10 mm, zeby 1 mm nie wygladal jak ulewa. */
const MIN_SCALE_MM = 10;

/**
 * "Czy w tym tygodniu bedzie lzej?" - prognoza na najblizsze dni: dzien tygodnia, najwyzsza temperatura, slupek
 * deszczu w mm (jedna os). Dzien z deszczem ma kropli ikone i pogrubiona liczbe, nie tylko kolor. Tylko dla analizy
 * "na dzis" - bez prognozy karta znika.
 */
export function ForecastWeek({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.forecast');
  const format = useFormatter();
  const forecast = reportExtras(report).forecast;

  if (!forecast) return null;
  const days = forecast.days.slice(0, 7);
  const summary = forecastSummary(days);
  const scale = Math.max(MIN_SCALE_MM, ...days.map((day) => day.precipitationMm ?? 0));
  const mm = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const weekday = (date: string) => format.dateTime(isoDay(date), { weekday: 'short', timeZone: 'UTC' });
  const longDay = (date: string) => format.dateTime(isoDay(date), { weekday: 'long', timeZone: 'UTC' });
  const tank = waterTank(report);
  const missing = tank?.growing ? tank.capacityMm - tank.availableMm : 0;
  const answer = summary.wettest
    ? t('answer', {
        days: days.length,
        total: mm(summary.totalMm),
        day: longDay(summary.wettest.date),
        max: mm(summary.wettest.precipitationMm ?? 0),
      })
    : t('answerDry', { days: days.length });
  // za malo, zeby uzupelnic zapas - tylko w sezonie, gdy brakuje wyraznie wiecej niz spadnie
  const tooLittle =
    summary.wettest && missing > summary.totalMm * 2 ? ` ${t('tooLittle', { missing: mm(missing) })}` : '';
  const issued = forecast.issuedAt ? new Date(forecast.issuedAt) : null;

  return (
    <ChartCard
      title={t('title')}
      answer={`${answer}${tooLittle}`}
      source={
        issued && !Number.isNaN(issued.getTime())
          ? t('sourceIssued', {
              source: forecast.source,
              date: format.dateTime(issued, { dateStyle: 'medium', timeZone: 'Europe/Warsaw' }),
            })
          : t('source', { source: forecast.source })
      }
      description={days
        .map((day) =>
          t('dayDescription', {
            day: longDay(day.date),
            mm: mm(day.precipitationMm ?? 0),
            temp: day.tMaxC === undefined ? '–' : mm(day.tMaxC),
          }),
        )
        .join('; ')}
      data-testid="chart-forecast"
    >
      <ol aria-hidden="true" className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const rain = day.precipitationMm ?? 0;
          const rainy = rain >= RAIN_DAY_MM;
          const Icon = rainy ? CloudRain : Sun;

          return (
            <li
              key={day.date}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2',
                rainy ? 'bg-water/10 ring-1 ring-water/40' : 'bg-muted',
              )}
              data-rainy={rainy || undefined}
            >
              <span className="text-sm font-semibold">{weekday(day.date)}</span>
              <Icon className={cn('size-5', rainy ? 'text-water' : 'text-warning')} />
              <span className="text-sm tabular-nums">
                {day.tMaxC === undefined ? '–' : t('temp', { temp: Math.round(day.tMaxC) })}
              </span>
              <svg viewBox="0 0 10 40" preserveAspectRatio="none" className="h-14 w-3">
                <rect x="0" y="0" width="10" height="40" className="fill-border" opacity="0.5" />
                <rect
                  x="0"
                  y={40 - (rain / scale) * 40}
                  width="10"
                  height={(rain / scale) * 40}
                  className="fill-water"
                />
              </svg>
              <span className={cn('text-base tabular-nums', rainy ? 'font-bold' : 'text-muted-foreground')}>
                {format.number(rain, { maximumFractionDigits: rain < 10 ? 1 : 0 })}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-base text-muted-foreground">{t('legend')}</p>
    </ChartCard>
  );
}
