import { describe, expect, it } from 'vitest';

import { nowIso, round } from './time';

describe('time', () => {
  it('round zaokrągla do podanej liczby miejsc (domyślnie 1)', () => {
    expect([round(1.24), round(1.25), round(-1.26), round(1.23456, 3), round(7.6, 0)]).toEqual([
      1.2, 1.3, -1.3, 1.235, 8,
    ]);
  });

  it('nowIso zwraca czas UTC w formacie ISO 8601', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
