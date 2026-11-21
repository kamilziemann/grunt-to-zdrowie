import { describe, expect, it } from 'vitest';

import { FIRST_IMAGERY_MONTH, imageryDate, imageryMonths, todayInPoland } from './imagery-months';

describe('imagery-months', () => {
  it('miesiace od biezacego wstecz do pierwszych scen Sentinel-2', () => {
    const months = imageryMonths('2018-02-10');

    expect(months.slice(0, 3)).toEqual(['2018-02', '2018-01', '2017-12']);
    expect(months.at(-1)).toBe(FIRST_IMAGERY_MONTH);
    expect(months).toHaveLength(11);
  });

  it('miesiac = jego ostatni dzien; biezacy miesiac i brak wyboru = dzis (undefined)', () => {
    expect(imageryDate('2018-06', '2026-11-22')).toBe('2018-06-30');
    expect(imageryDate('2024-02', '2026-11-22')).toBe('2024-02-29');
    expect(imageryDate('2026-11', '2026-11-22')).toBeUndefined();
    expect(imageryDate(null, '2026-11-22')).toBeUndefined();
  });

  it('dzis liczone w strefie Polski', () => {
    expect(todayInPoland(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-22');
  });
});
