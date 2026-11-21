import { CROP_IDS } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { CROP_PROFILES, cropProfile } from './crops';

describe('katalog upraw', () => {
  it('ma profil dla kazdej uprawy z kontraktu', () => {
    expect(CROP_PROFILES.map((profile) => profile.id)).toEqual([...CROP_IDS]);
  });

  it('parametry mieszcza sie w zakresach FAO-56', () => {
    const problems = CROP_PROFILES.flatMap((profile) => {
      const { kc, stageDays, rootDepthM, depletionFraction: p } = profile;
      const season = stageDays.initial + stageDays.development + stageDays.mid + stageDays.late;
      const checks: [boolean, string][] = [
        [kc.mid >= kc.initial && kc.mid <= 1.3, 'Kc w pelni rozwoju'],
        [kc.initial > 0 && kc.end > 0, 'Kc dodatnie'],
        [season >= 100 && season <= 240, 'dlugosc sezonu'],
        [rootDepthM.min > 0 && rootDepthM.max >= rootDepthM.min && rootDepthM.max <= 2, 'glebokosc korzeni'],
        [p >= 0.2 && p <= 0.65, 'frakcja wyczerpania'],
      ];

      return checks.filter(([ok]) => !ok).map(([, name]) => `${profile.id}: ${name}`);
    });

    expect(problems).toEqual([]);
  });

  it('tylko uzytki zielone nie maja grupy progow IUNG', () => {
    expect(
      CROP_PROFILES.filter((profile) => profile.iungGroup === null).map((profile) => profile.id),
    ).toEqual(['grassland']);
    expect(cropProfile('winter_wheat').iungGroup).toBe('winter_cereals');
  });
});
