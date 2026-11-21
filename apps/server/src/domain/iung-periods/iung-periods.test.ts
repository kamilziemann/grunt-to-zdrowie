import { describe, expect, it } from 'vitest';

import { daysBetween } from '../iso-date';
import { iungPeriodEndingBy, iungPeriods, IUNG_PERIOD_COUNT } from './iung-periods';

describe('okresy IUNG', () => {
  it('jest 14 okresow od 21 marca do 30 wrzesnia, kazdy ok. 60 dni', () => {
    const periods = iungPeriods(2026);

    expect(periods).toHaveLength(IUNG_PERIOD_COUNT);
    expect(periods[0]).toEqual({ no: 1, from: '2026-03-21', to: '2026-05-20' });
    expect(periods.at(-1)).toEqual({ no: 14, from: '2026-08-01', to: '2026-09-30' });
    expect(periods.every((period) => Math.abs(daysBetween(period.from, period.to) + 1 - 61) <= 1)).toBe(true);
  });

  it('wybiera ostatni okres zakonczony do daty analizy', () => {
    expect(iungPeriodEndingBy('2026-06-30')?.no).toBe(5);
    expect(iungPeriodEndingBy('2026-07-05')?.no).toBe(5);
    expect(iungPeriodEndingBy('2026-09-30')?.no).toBe(14);
  });

  it('poza sezonem nie ma okresu', () => {
    expect(iungPeriodEndingBy('2026-04-15')).toBeNull();
    expect(iungPeriodEndingBy('2026-11-21')).toBeNull();
    expect(iungPeriodEndingBy('2026-01-10')).toBeNull();
  });
});
