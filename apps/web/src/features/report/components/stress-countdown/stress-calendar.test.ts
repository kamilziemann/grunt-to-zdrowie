import { describe, expect, it } from 'vitest';

import { stressCalendar } from './stress-calendar';

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe('stressCalendar', () => {
  it('siatka od poniedzialku tygodnia analizy do niedzieli tygodnia progu; dzis, zapas, prog', () => {
    // czwartek 18.06.2026 + 6 dni zapasu = prog w srode 24.06
    const model = stressCalendar('2026-06-18', 6);

    expect(model.thresholdTime).toBe(day('2026-06-24'));
    expect(model.lastGoodTime).toBe(day('2026-06-23'));
    expect(model.weeks).toBe(2);
    expect(model.days[0]?.time).toBe(day('2026-06-15'));
    expect(model.days.at(-1)?.time).toBe(day('2026-06-28'));
    expect(model.days.filter((item) => item.kind === 'today').map((item) => item.time)).toEqual([
      day('2026-06-18'),
    ]);
    expect(model.days.filter((item) => item.kind === 'reserve')).toHaveLength(5);
    expect(model.days.find((item) => item.kind === 'threshold')?.time).toBe(day('2026-06-24'));
  });

  it('jeden dzien zapasu: prog jutro, bez dni posrednich', () => {
    const model = stressCalendar('2026-06-21', 1);

    expect(model.days.filter((item) => item.kind === 'reserve')).toHaveLength(0);
    expect(model.thresholdTime).toBe(day('2026-06-22'));
    expect(model.weeks).toBe(2);
  });

  it('dlugi zapas daje ponad 5 tygodni - karta pokazuje wtedy samo zdanie', () => {
    expect(stressCalendar('2026-06-01', 40).weeks).toBeGreaterThan(5);
  });
});
