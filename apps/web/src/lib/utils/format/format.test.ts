import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatDateTime } from './format';

// Pierwszy blok (formatery sa cache'owane): proces w UTC jak Workers - godzina i tak warszawska.
describe('formatDateTime: strefa', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'UTC';
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('godzina jest warszawska niezaleznie od strefy srodowiska (serwer = UTC, przegladarka = lokalna)', () => {
    expect(formatDateTime('2026-10-21T18:41:00.000Z', 'pl')).toBe('21 paź 2026, 20:41');
    expect(formatDateTime('2026-01-15T07:05:00.000Z', 'en')).toContain('8:05');
  });
});

describe('formatDateTime', () => {
  it('brak daty to myślnik', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('niepoprawna data wraca bez zmian', () => {
    expect(formatDateTime('nie-data')).toBe('nie-data');
  });

  it('poprawna data zawiera rok', () => {
    expect(formatDateTime('2026-10-16T12:30:00.000Z')).toContain('2026');
  });

  it('format zależy od języka interfejsu', () => {
    const iso = '2026-10-16T12:30:00.000Z';

    expect(formatDateTime(iso, 'pl')).toContain('paź');
    expect(formatDateTime(iso, 'en')).toContain('Oct');
  });
});
