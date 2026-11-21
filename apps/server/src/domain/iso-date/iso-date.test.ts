import { describe, expect, it } from 'vitest';

import {
  addDays,
  addYears,
  dayOfYear,
  daysBetween,
  isoDate,
  isoDateInPoland,
  monthOf,
  withYear,
  yearOf,
} from './iso-date';

describe('iso-date', () => {
  it('dodaje dni przez granice miesiaca, roku i zmiane czasu', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('liczy roznice, dzien roku i skladowe daty', () => {
    expect(daysBetween('2026-05-01', '2026-06-30')).toBe(60);
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2024-12-31')).toBe(366);
    expect([yearOf('2026-11-21'), monthOf('2026-11-21')]).toEqual([2026, 11]);
    expect(isoDate(2026, 6, 30)).toBe('2026-06-30');
  });

  it('przenosi date do innego roku, 29 lutego na 28 lutego', () => {
    expect(withYear('2024-02-29', 2023)).toBe('2023-02-28');
    expect(addYears('2026-11-21', -10)).toBe('2016-11-21');
  });

  it('dzien w Polsce moze byc juz nastepny niz w UTC', () => {
    expect(isoDateInPoland('2026-11-21T23:30:00.000Z')).toBe('2026-11-22');
    expect(isoDateInPoland('2026-07-01T12:00:00.000Z')).toBe('2026-07-01');
  });
});
