import type { WaterReport } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { reportExtras } from '../../utils/report-extras';
import { ChartCard } from '../chart-card';
import { CALENDAR_MAX_WEEKS, StressCalendar, stressCalendar } from './stress-calendar';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** horyzont odliczania, gdy raport go nie podaje */
const DEFAULT_HORIZON_DAYS = 60;

/**
 * "Ile dni zostalo, zanim uprawa przestanie rosnac?" - odliczanie z silnika (zapas ponizej progu stresu bez deszczu
 * i z deszczem z prognozy): liczba dni, zdanie "do srody, od czwartku" i kalendarz do dnia progu. Gdy stres juz
 * trwa - od ilu dni. Poza sezonem uprawy i bez pola `waterNow` karta znika.
 */
export function StressCountdown({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.countdown');
  const format = useFormatter();
  const now = reportExtras(report).waterNow;

  if (!now?.growing) return null;
  const stressed = now.stressedSinceDays !== undefined || now.daysToStressNoRain === 0;
  const horizon = now.horizonDays ?? DEFAULT_HORIZON_DAYS;

  if (stressed) {
    const since = now.stressedSinceDays ?? 1;

    return (
      <ChartCard
        title={t('stressedTitle')}
        answer={t('stressedAnswer')}
        source={t('source')}
        data-testid="chart-countdown"
      >
        <p className="flex items-baseline gap-3">
          <span className="text-6xl leading-none font-bold text-warning tabular-nums">{since}</span>
          <span className="text-xl font-semibold">{t('stressedUnit', { days: since })}</span>
        </p>
      </ChartCard>
    );
  }

  const noRain = now.daysToStressNoRain;
  const withRain = now.daysToStressWithForecast;

  // zapas wystarczy poza horyzont liczenia: sama liczba "60+" i zdanie
  if (noRain === undefined) {
    const answer = t('beyondAnswer', { days: horizon });

    return (
      <ChartCard title={t('title')} answer={answer} source={t('source')} data-testid="chart-countdown">
        <p className="flex items-baseline gap-3">
          <span className="font-sans text-6xl leading-none font-bold text-water">
            {t('beyond', { days: horizon })}
          </span>
        </p>
        <p className="text-lg">{t('lead')}</p>
      </ChartCard>
    );
  }

  const calendar = stressCalendar(report.meta.analysisDate, noRain);
  const weekday = (time: number) =>
    t(`weekdaysGenitive.${WEEKDAY_KEYS[(new Date(time).getUTCDay() + 6) % 7] ?? 'mon'}`);
  const dayMonth = (time: number) =>
    format.dateTime(new Date(time), { day: 'numeric', month: 'long', timeZone: 'UTC' });
  // "Bez deszczu woda wystarczy do srody, 24 czerwca. Od czwartku rosliny zaczna cierpiec."
  const sentence = t('until', {
    lastDay: weekday(calendar.lastGoodTime),
    lastDate: dayMonth(calendar.lastGoodTime),
    thresholdDay: weekday(calendar.thresholdTime),
  });
  const answer =
    withRain !== undefined && withRain !== noRain
      ? `${sentence} ${t('withForecast', { withRain })}`
      : sentence;

  return (
    <ChartCard
      title={t('title')}
      answer={answer}
      source={t('source')}
      description={answer}
      data-testid="chart-countdown"
    >
      <p className="flex items-baseline gap-3">
        <span className="font-sans text-6xl leading-none font-bold text-warning">{noRain}</span>
        <span className="text-xl font-semibold">{t('unit', { days: noRain })}</span>
      </p>
      <p className="text-lg">{t('lead')}</p>
      {/* ponad 5 tygodni: samo zdanie z data, bez kalendarza */}
      {calendar.weeks <= CALENDAR_MAX_WEEKS && <StressCalendar model={calendar} daysLeft={noRain} />}
    </ChartCard>
  );
}
