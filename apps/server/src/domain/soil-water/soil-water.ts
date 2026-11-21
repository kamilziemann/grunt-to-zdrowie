// Woda w glebie z uziarnienia i materii organicznej: funkcja pedotransferowa Saxtona i Rawlsa (2006, SSSAJ 70:1569,
// tab. 1) - wilgotnosc przy polowej pojemnosci wodnej (33 kPa) i w punkcie trwalego wiedniecia (1500 kPa) dla gleb
// mineralnych przy standardowej gestosci, bez szkieletu. Rownania sa regresja na danych USDA: poza zakresem
// (il > 60%, materia organiczna > 8%) wynik jest przyblizeniem, wiec wejscie przycinamy do tego zakresu.

export interface SoilTexture {
  sandPct: number;
  clayPct: number;
  /** materia organiczna, % wagowo */
  organicMatterPct: number;
}

export interface SoilWater {
  /** m3/m3 */
  fieldCapacity: number;
  wiltingPoint: number;
  /** woda dostepna dla roslin (FC - WP), m3/m3 */
  availableWater: number;
}

/** Przelicznik wegla organicznego na materie organiczna (wspolczynnik van Bemmelena). */
export const CARBON_TO_ORGANIC_MATTER = 1.724;

const MAX_CLAY_PCT = 60;
const MAX_ORGANIC_MATTER_PCT = 8;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** Materia organiczna (%) z wegla organicznego w g/kg. */
export function organicMatterFromCarbon(carbonGPerKg: number): number {
  return (CARBON_TO_ORGANIC_MATTER * carbonGPerKg) / 10;
}

export function saxtonRawls({ sandPct, clayPct, organicMatterPct }: SoilTexture): SoilWater {
  const s = clamp(sandPct, 0, 100) / 100;
  const c = clamp(clayPct, 0, MAX_CLAY_PCT) / 100;
  const om = clamp(organicMatterPct, 0, MAX_ORGANIC_MATTER_PCT);
  const wilt = -0.024 * s + 0.487 * c + 0.006 * om + 0.005 * s * om - 0.013 * c * om + 0.068 * s * c + 0.031;
  const field = -0.251 * s + 0.195 * c + 0.011 * om + 0.006 * s * om - 0.027 * c * om + 0.452 * s * c + 0.299;
  const wiltingPoint = wilt + (0.14 * wilt - 0.02);
  const fieldCapacity = field + (1.283 * field * field - 0.374 * field - 0.015);

  return {
    fieldCapacity,
    wiltingPoint,
    availableWater: Math.max(0, fieldCapacity - wiltingPoint),
  };
}
