// Stan uprawy w dacie analizy: faza rozwoju, wspolczynnik Kc i glebokosc korzeni z krzywej FAO-56 (odcinki stale
// w fazie poczatkowej i srodkowej, liniowe w rozwoju i koncowej). Wersja bazowa z katalogu upraw; pakiet bilansu
// strefy korzeniowej (P7) rozszerza ten modul o przebieg dobowy.
import type { CropAtDate, CropId, CropStage } from '@app/contracts';

import { cropProfile } from '../crops';
import { daysBetween, isoDate, yearOf } from '../iso-date';

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

export function cropAtDate(cropId: CropId, date: string): CropAtDate {
  const profile = cropProfile(cropId);
  const { stageDays, kc, rootDepthM } = profile;
  const start = isoDate(yearOf(date), profile.seasonStart.month, profile.seasonStart.day);
  const day = daysBetween(start, date);
  const developmentEnd = stageDays.initial + stageDays.development;
  const midEnd = developmentEnd + stageDays.mid;
  const seasonEnd = midEnd + stageDays.late;
  const base = { cropId, iungGroup: profile.iungGroup };

  // Poza krzywa Kc: ozimina i roslina wieloletnia jest w spoczynku, jara - przed siewem albo po zbiorze.
  if (day < 0 || day > seasonEnd) {
    const stage: CropStage = profile.overwinters || day < 0 ? 'dormant' : 'harvested';

    return { ...base, stage, kc: null, rootDepthM: null };
  }

  // Korzenie rosna liniowo do pelni rozwoju; rosliny zimujace zaczynaja sezon z rozwinietym systemem.
  const growth = profile.overwinters ? 1 : Math.min(1, day / developmentEnd);
  const depth = round(rootDepthM.min + (rootDepthM.max - rootDepthM.min) * growth, 2);

  if (day <= stageDays.initial) return { ...base, stage: 'initial', kc: kc.initial, rootDepthM: depth };

  if (day <= developmentEnd) {
    const share = (day - stageDays.initial) / stageDays.development;

    return {
      ...base,
      stage: 'development',
      kc: round(kc.initial + (kc.mid - kc.initial) * share, 2),
      rootDepthM: depth,
    };
  }

  if (day <= midEnd) return { ...base, stage: 'mid', kc: kc.mid, rootDepthM: depth };

  const share = (day - midEnd) / stageDays.late;

  return { ...base, stage: 'late', kc: round(kc.mid + (kc.end - kc.mid) * share, 2), rootDepthM: depth };
}
