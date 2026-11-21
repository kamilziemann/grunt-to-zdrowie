// Teren odwadniany mechanicznie (polder, np. Zulawy): pole przy poziomie morza albo ponizej, gesta siec rowow i waly
// w poblizu. Model terenu widzi tam "zaglebienia bez odplywu", ale woda odplywa rowami do przepompowni - obnizenie jest
// czescia polderu, a nie miejscem na oczko. Zamiast oczka zalecamy zatrzymanie wody w rowach (regulowany odplyw).
// Dane z atrap nie sa dowodem.
import type { Evidence } from '@app/contracts';

import type { StageInput } from '../analysis-stages';

/** najnizszy punkt pola co najwyzej tyle m n.p.m. - teren nizinny przy morzu albo w delcie */
export const LOWLAND_MAX_M = 2;
/** ponizej (lub na) poziomie morza woda nie odplynie grawitacyjnie - polder nawet bez walu w promieniu */
export const BELOW_SEA_M = 0;
/** gesta siec rowow: tyle odcinkow rowow w 500 m od pola (Zulawy: 156, pole w Wielkopolsce: 10) */
export const DENSE_DITCHES = 40;
/** wal albo grobla w tej odleglosci od pola (m) */
export const LEVEE_NEAR_M = 3000;

export interface DrainedLowland {
  detected: boolean;
  /** dowody: najnizsza wysokosc pola, odcinki rowow w promieniu, najblizszy wal */
  evidence: Evidence[];
}

export function drainedLowland({
  terrain,
  hydro,
  surroundings,
  sampleSources = [],
}: StageInput): DrainedLowland {
  const none: DrainedLowland = { detected: false, evidence: [] };

  if (!terrain || !hydro || sampleSources.includes('terrain') || sampleSources.includes('hydro')) return none;

  const elevation = terrain.summary.elevationMinM;
  const ditches = hydro.ditchesInRadius ?? 0;
  const levee = surroundings?.water.nearestLeveeM ?? null;
  const leveeNear = levee !== null && levee <= LEVEE_NEAR_M;
  const detected =
    elevation <= LOWLAND_MAX_M && ditches >= DENSE_DITCHES && (elevation <= BELOW_SEA_M || leveeNear);

  if (!detected) return none;

  return {
    detected,
    evidence: [
      {
        metric: 'elevation_min_m',
        value: Number(elevation.toFixed(1)),
        unit: 'm',
        reference: LOWLAND_MAX_M,
        source: 'terrain',
      },
      {
        metric: 'ditches_in_radius',
        value: ditches,
        unit: 'count',
        reference: hydro.searchRadiusM,
        source: 'hydro',
      },
      ...(leveeNear
        ? [{ metric: 'nearest_levee_m', value: levee, unit: 'm', source: 'hydro' as const }]
        : []),
    ],
  };
}
