// Wspolne wskazniki wodne dla etapow oceny i historii: KBW okresu IUNG z progiem dla uprawy i gleby oraz dobowa
// symulacja strefy korzeniowej po calej serii pogody. Jedno miejsce na decyzje "z jakiej kategorii gleby i jakiego
// punktu liczymy", zeby ocena i historia nie rozjechaly sie w szczegolach.
import type { IungCropGroup, SoilCategory } from '@app/contracts';

import type { SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { climaticWaterBalance, type ClimaticWaterBalance } from '../climatic-water-balance';
import { iungThreshold } from '../iung-thresholds';
import { simulateRootZone, type RootZoneSimulation } from '../root-zone-balance';
import { soilProfileFromLayers } from '../soil-profile';

export const SOIL_CATEGORIES: readonly SoilCategory[] = [1, 2, 3, 4];

/** nadmiar wody: KBW okresu (60 dni) powyzej tej wartosci (mm) - opad wyraznie przewyzsza parowanie */
export const EXCESS_BALANCE_MM = 50;
/**
 * Przed pierwszym pelnym okresem IUNG (21 marca - 20 maja) okno 60 dni siega zimy: parowanie jest wtedy male i bilans
 * +50...+80 mm to zwykle wiosenne zasilenie gleby, nie nadmiar. Nadmiar mowimy dopiero przy dwukrotnie wyzszym.
 */
export const EXCESS_BALANCE_EARLY_MM = 100;

/** Gdy gleba jest nieznana, historia (jeden glos na sezon) liczy sie dla kategorii II - najczestszej w Polsce. */
export const FALLBACK_SOIL_CATEGORY: SoilCategory = 2;

/**
 * Gleba srednia (kategoria III, glina lekka 50/35/15, 2% materii organicznej) - jawne zalozenie bilansu strefy
 * korzeniowej, gdy gleby nie ma ani w polu, ani w poblizu. Werdykt KBW opiera sie wtedy na scenariuszach czterech
 * kategorii, a nie na tym zalozeniu.
 */
export const ASSUMED_MEDIUM_SOIL: SoilProfile = {
  ...(soilProfileFromLayers([
    { topCm: 0, bottomCm: 200, sandPct: 50, siltPct: 35, clayPct: 15, organicCarbonGPerKg: 11.6 },
  ]) ?? {
    sandPct: 50,
    siltPct: 35,
    clayPct: 15,
    organicMatterPct: 2,
    fieldCapacity: 0.26,
    wiltingPoint: 0.12,
    availableWaterMmPerM: 140,
    category: 3,
    basis: 'texture',
  }),
  category: 3,
  categoryRange: [1, 4],
};

/** Gleba bilansu strefy korzeniowej: z pola (takze zastepcza z poblizu) albo przyjeta gleba srednia. */
export function balanceSoil(input: StageInput): { soil: SoilProfile; assumed: boolean } {
  return input.soil ? { soil: input.soil, assumed: false } : { soil: ASSUMED_MEDIUM_SOIL, assumed: true };
}

export type PeriodVerdict = 'drought' | 'ok' | 'not_monitored' | 'not_grown' | 'missing';

export interface PeriodAssessment {
  balance: ClimaticWaterBalance;
  thresholdMm: number | null;
  verdict: PeriodVerdict;
}

/** KBW okresu i werdykt wzgledem progu IUNG dla grupy upraw i kategorii gleby. */
export function assessPeriod(
  input: StageInput,
  period: { no: number; from: string; to: string },
  group: IungCropGroup | null,
  category: SoilCategory,
): PeriodAssessment {
  const balance = input.meteo
    ? climaticWaterBalance(input.meteo.days, period.from, period.to, input.field.centroid[1])
    : {
        from: period.from,
        to: period.to,
        precipMm: null,
        evapotranspirationMm: null,
        balanceMm: null,
        coverage: 0,
      };

  if (balance.balanceMm === null) return { balance, thresholdMm: null, verdict: 'missing' };

  if (group === null) return { balance, thresholdMm: null, verdict: 'not_monitored' };

  const threshold = iungThreshold(group, category, period.no);

  if (threshold.kind === 'not_grown') return { balance, thresholdMm: null, verdict: 'not_grown' };

  if (threshold.kind === 'not_assessed') return { balance, thresholdMm: null, verdict: 'not_monitored' };

  return {
    balance,
    thresholdMm: threshold.thresholdMm,
    verdict: balance.balanceMm < threshold.thresholdMm ? 'drought' : 'ok',
  };
}

/** Symulacja strefy korzeniowej po calej serii pogody; null bez pogody. Bez gleby - na glebie sredniej. */
export function rootZoneSimulation(input: StageInput): RootZoneSimulation | null {
  const { meteo } = input;
  const { soil } = balanceSoil(input);

  if (!meteo) return null;

  return simulateRootZone(
    meteo.days.filter((day) => day.date <= input.date),
    {
      cropId: input.cropId,
      availableWaterMmPerM: soil.availableWaterMmPerM,
      latitude: input.field.centroid[1],
      elevationM: meteo.elevationM ?? 0,
    },
  );
}
