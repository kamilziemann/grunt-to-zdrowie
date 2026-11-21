// Wspolne wskazniki wodne dla etapow oceny i historii: KBW okresu IUNG z progiem dla uprawy i gleby oraz dobowa
// symulacja strefy korzeniowej po calej serii pogody. Jedno miejsce na decyzje "z jakiej kategorii gleby i jakiego
// punktu liczymy", zeby ocena i historia nie rozjechaly sie w szczegolach.
import type { IungCropGroup, SoilCategory } from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import { climaticWaterBalance, type ClimaticWaterBalance } from '../climatic-water-balance';
import { iungThreshold } from '../iung-thresholds';
import { simulateRootZone, type RootZoneSimulation } from '../root-zone-balance';

export const SOIL_CATEGORIES: readonly SoilCategory[] = [1, 2, 3, 4];

/** Gdy gleba jest nieznana, historia (jeden glos na sezon) liczy sie dla kategorii II - najczestszej w Polsce. */
export const FALLBACK_SOIL_CATEGORY: SoilCategory = 2;

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

/** Symulacja strefy korzeniowej po calej serii pogody; null bez pogody albo bez gleby. */
export function rootZoneSimulation(input: StageInput): RootZoneSimulation | null {
  const { meteo, soil } = input;

  if (!meteo || !soil) return null;

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
