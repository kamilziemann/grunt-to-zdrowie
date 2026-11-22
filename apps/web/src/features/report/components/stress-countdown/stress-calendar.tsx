// Kalendarz "do kiedy wystarczy wody": siatka poniedzialek-niedziela od tygodnia z dniem analizy do tygodnia z dniem
// progu (dzien analizy + liczba dni zapasu). Dzis - biale pole z obwodka, dni z zapasem - coraz ciemniejszy piasek,
// dzien progu - ciemny pomarancz (`warning`) z podpisem "prog". Kolory z tokenow danych (ADR 0007), bez surowych wartosci.
import { useFormatter, useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

const DAY_MS = 24 * 60 * 60 * 1000;
/** dluzszy kalendarz niz tyle tygodni nic nie mowi - zostaje samo zdanie z data */
export const CALENDAR_MAX_WEEKS = 5;

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
/** tlo dni z zapasem: coraz mocniejszy pomarancz danych na bialej karcie */
const RESERVE_SHADES = [
  'bg-data-orange/20',
  'bg-data-orange/35',
  'bg-data-orange/50',
  'bg-data-orange/60',
  'bg-data-orange/70',
] as const;

const utcDay = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
/** poniedzialek = 0 ... niedziela = 6 */
const weekdayIndex = (time: number): number => (new Date(time).getUTCDay() + 6) % 7;

export interface StressCalendarModel {
  /** dzien progu: pierwszy dzien, w ktorym zapas jest ponizej progu */
  thresholdTime: number;
  /** ostatni dzien z zapasem */
  lastGoodTime: number;
  weeks: number;
  /** dni siatki od poniedzialku pierwszego tygodnia */
  days: { time: number; kind: 'today' | 'reserve' | 'threshold' | 'other'; step: number }[];
}

/** Model siatki dla dnia analizy i liczby dni zapasu (>= 1). */
export function stressCalendar(analysisDate: string, daysLeft: number): StressCalendarModel {
  const today = utcDay(analysisDate);
  const thresholdTime = today + daysLeft * DAY_MS;
  const start = today - weekdayIndex(today) * DAY_MS;
  const end = thresholdTime + (6 - weekdayIndex(thresholdTime)) * DAY_MS;
  const total = Math.round((end - start) / DAY_MS) + 1;

  return {
    thresholdTime,
    lastGoodTime: thresholdTime - DAY_MS,
    weeks: total / 7,
    days: Array.from({ length: total }, (_unused, index) => {
      const time = start + index * DAY_MS;
      const step = Math.round((time - today) / DAY_MS);

      return {
        time,
        step,
        kind:
          time === today
            ? 'today'
            : time === thresholdTime
              ? 'threshold'
              : time > today && time < thresholdTime
                ? 'reserve'
                : 'other',
      };
    }),
  };
}

/** Siatka kalendarza; opis slowny daje karta (`answer`), wiec siatka jest ukryta przed czytnikami. */
export function StressCalendar({ model, daysLeft }: { model: StressCalendarModel; daysLeft: number }) {
  const t = useTranslations('report.viz.countdown');
  const format = useFormatter();

  return (
    <div aria-hidden="true" className="flex flex-col gap-1" data-testid="countdown-calendar">
      <ol className="grid grid-cols-7 gap-1 text-center text-[0.8125rem] text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <li key={day}>{t(`weekdaysShort.${day}`)}</li>
        ))}
      </ol>
      <ol className="grid grid-cols-7 gap-1">
        {model.days.map((day) => {
          // zapas: od jasnego piasku do pomaranczu tuz przed progiem (piec stopni tego samego tokenu)
          const share = daysLeft > 1 ? (day.step - 1) / (daysLeft - 1) : 1;
          const shade =
            RESERVE_SHADES[Math.min(RESERVE_SHADES.length - 1, Math.floor(share * RESERVE_SHADES.length))];

          return (
            <li
              key={day.time}
              data-day={day.kind}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center rounded-lg text-base leading-tight font-semibold',
                day.kind === 'today' && 'border-2 border-foreground bg-card text-foreground',
                day.kind === 'reserve' && cn('text-accent-foreground', shade),
                day.kind === 'threshold' && 'bg-warning text-warning-foreground',
                day.kind === 'other' && 'border font-normal text-muted-foreground',
              )}
            >
              {format.dateTime(new Date(day.time), { day: 'numeric', timeZone: 'UTC' })}
              {day.kind === 'today' && <span className="text-[0.6875rem] font-medium">{t('today')}</span>}
              {day.kind === 'threshold' && (
                <span className="text-[0.6875rem] font-medium">{t('threshold')}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
