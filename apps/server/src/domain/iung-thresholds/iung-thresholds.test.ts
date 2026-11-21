import { IUNG_CROP_GROUPS } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { iungThreshold, iungThresholdMm } from './iung-thresholds';

describe('iungThreshold (tabela z https://susza.iung.pulawy.pl/progi/)', () => {
  it('odczytuje wartosci z tabeli: wiersz uprawy i kategorii gleby, kolumna okresu', () => {
    expect(iungThresholdMm('winter_cereals', 1, 1)).toBe(-129);
    expect(iungThresholdMm('winter_cereals', 3, 6)).toBe(-224);
    expect(iungThresholdMm('spring_cereals', 4, 9)).toBe(-276);
    expect(iungThresholdMm('maize_grain', 2, 4)).toBe(-200);
    expect(iungThresholdMm('rapeseed', 1, 13)).toBe(-138);
    expect(iungThresholdMm('potato', 4, 3)).toBe(-306);
    expect(iungThresholdMm('pulses', 4, 14)).toBe(-249);
    expect(iungThresholdMm('fruit_trees', 4, 12)).toBe(-304);
  });

  it('rozroznia "x" (okres nieoceniany) od "-" (uprawa nie na tej glebie)', () => {
    expect(iungThreshold('winter_cereals', 2, 10)).toEqual({ kind: 'not_assessed' });
    expect(iungThreshold('rapeseed', 3, 7)).toEqual({ kind: 'not_assessed' });
    expect(iungThreshold('sugar_beet', 1, 5)).toEqual({ kind: 'not_grown' });
    expect(iungThreshold('sugar_beet', 2, 5)).toEqual({ kind: 'threshold', thresholdMm: -237 });
  });

  it('lzejsza gleba ma prog blizszy zera (susza przychodzi szybciej) w kazdej grupie i okresie', () => {
    const problems: string[] = [];

    for (const group of IUNG_CROP_GROUPS) {
      for (let period = 1; period <= 14; period += 1) {
        const values = ([1, 2, 3, 4] as const).map((category) => iungThresholdMm(group, category, period));
        const known = values.filter((value): value is number => value !== null);

        if (known.some((value, index) => index > 0 && value >= (known[index - 1] ?? 0))) {
          problems.push(`${group} ${period}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('numer okresu spoza 1-14 to blad programisty', () => {
    expect(() => iungThreshold('potato', 2, 0)).toThrow(RangeError);
    expect(() => iungThreshold('potato', 2, 15)).toThrow(RangeError);
  });
});
