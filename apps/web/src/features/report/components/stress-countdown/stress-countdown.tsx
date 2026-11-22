import type { WaterReport } from '@app/contracts';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { reportExtras } from '../../utils/report-extras';
import { ChartCard } from '../chart-card';

/** Ile dni pokazujemy na pasku odliczania (dalej szczegoly nie zmieniaja decyzji). */
const STRIP_DAYS = 10;

const DAY_KEYS = Array.from({ length: STRIP_DAYS }, (_, index) => index + 1);

/** Pasek dni: piasek -> pomarancz do dnia stresu (znak "!"), potem jasne pola; dzien z deszczem z prognozy - kropla. */
function Strip({ label, days, testId }: { label: string; days: number | undefined; testId: string }) {
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <span className="text-base font-medium">{label}</span>
      <ol aria-hidden="true" className="grid grid-cols-10 gap-1">
        {DAY_KEYS.map((day) => {
          const stressDay = days !== undefined && day === days;
          const before = days === undefined || day < days;

          return (
            <li
              key={day}
              className={cn(
                'flex h-9 items-center justify-center rounded-md text-sm font-bold',
                stressDay && 'bg-viz-orange-deep text-background',
                !stressDay &&
                  before &&
                  (days !== undefined && day >= days - 2 ? 'bg-viz-orange' : 'bg-viz-sand'),
                !stressDay && !before && 'border border-dashed border-viz-orange-strong bg-viz-track',
              )}
            >
              {stressDay ? '!' : day}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * "Ile dni zostalo, zanim uprawa przestanie rosnac?" - odliczanie z silnika (zapas ponizej progu stresu bez deszczu
 * i z deszczem z prognozy). Gdy stres juz trwa - od ilu dni. Poza sezonem uprawy i bez pola `waterNow` karta znika.
 */
export function StressCountdown({ report }: { report: WaterReport }) {
  const t = useTranslations('report.viz.countdown');
  const now = reportExtras(report).waterNow;

  if (!now?.growing) return null;
  const stressed = now.stressedSinceDays !== undefined || now.daysToStressNoRain === 0;
  const horizon = now.horizonDays ?? STRIP_DAYS;

  if (stressed) {
    const since = now.stressedSinceDays ?? 1;

    return (
      <ChartCard
        title={t('title')}
        answer={t('stressedAnswer', { days: since })}
        source={t('source')}
        data-testid="chart-countdown"
      >
        <p className="flex items-baseline gap-3">
          <span className="text-6xl leading-none font-bold text-viz-orange-deep tabular-nums">{since}</span>
          <span className="text-xl font-semibold">{t('stressedUnit', { days: since })}</span>
        </p>
        <p className="text-lg">{t('stressedLead')}</p>
      </ChartCard>
    );
  }

  const noRain = now.daysToStressNoRain;
  const withRain = now.daysToStressWithForecast;
  const answer =
    noRain === undefined
      ? t('beyondAnswer', { days: horizon })
      : withRain !== undefined && withRain !== noRain
        ? t('answerForecast', { days: noRain, withRain })
        : t('answer', { days: noRain });

  return (
    <ChartCard
      title={t('title')}
      answer={answer}
      source={t('source')}
      description={answer}
      data-testid="chart-countdown"
    >
      <p className="flex items-baseline gap-3">
        <span
          className={cn(
            'text-6xl leading-none font-bold tabular-nums',
            noRain === undefined ? 'text-viz-water' : 'text-viz-orange-deep',
          )}
        >
          {noRain ?? t('beyond', { days: horizon })}
        </span>
        {noRain !== undefined && <span className="text-xl font-semibold">{t('unit', { days: noRain })}</span>}
      </p>
      <p className="text-lg">{t('lead')}</p>
      {noRain !== undefined && noRain <= STRIP_DAYS && (
        <div className="flex flex-col gap-3">
          <Strip label={t('noRain')} days={noRain} testId="countdown-no-rain" />
          {withRain !== undefined && (
            <Strip
              label={t('withRain')}
              days={withRain <= STRIP_DAYS ? withRain : undefined}
              testId="countdown-forecast"
            />
          )}
        </div>
      )}
    </ChartCard>
  );
}
