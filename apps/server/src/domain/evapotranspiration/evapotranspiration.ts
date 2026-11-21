// Ewapotranspiracja wskaznikowa ET0 (trawa referencyjna) wg FAO-56: dobowy Penman-Monteith (rownanie 6) z
// promieniowania, temperatur, wilgotnosci i wiatru, a przy brakach Hargreaves (rownanie 52) z samych temperatur.
// Zrodlo wzorow: Allen i in. 1998, FAO Irrigation and Drainage Paper 56, rozdz. 3-4
// (https://www.fao.org/4/X0490E/x0490e00.htm). Tu tez promieniowanie pozaziemskie i dlugosc dnia, z ktorych
// korzysta szacunek uslonecznienia dla KBW wg IUNG (domain/climatic-water-balance).
import type { DailyWeather } from '../analysis-ports';
import { dayOfYear } from '../iso-date';

/** stala sloneczna (MJ m-2 min-1) */
const SOLAR_CONSTANT = 0.082;
/** Stefan-Boltzmann na dobe (MJ K-4 m-2 d-1) */
const STEFAN_BOLTZMANN = 4.903e-9;
/** albedo trawy referencyjnej */
const ALBEDO = 0.23;
/** wspolczynniki Angstroma (FAO-56 rownanie 35) przy braku kalibracji lokalnej */
const ANGSTROM_A = 0.25;
const ANGSTROM_B = 0.5;

export type Et0Method = 'fao56_penman_monteith' | 'hargreaves';

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** Cisnienie pary nasyconej w temperaturze t (kPa), rownanie 11. */
export function saturationVapourPressure(tC: number): number {
  return 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));
}

interface SolarGeometry {
  /** promieniowanie pozaziemskie Ra (MJ m-2 d-1), rownanie 21 */
  ra: number;
  /** astronomiczna dlugosc dnia N (h), rownanie 34 */
  daylightHours: number;
}

/** Ra i N dla szerokosci geograficznej (stopnie) i dnia roku. */
export function solarGeometry(latitude: number, doy: number): SolarGeometry {
  const phi = toRadians(latitude);
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * doy);
  const declination = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
  const omega = Math.acos(clamp(-Math.tan(phi) * Math.tan(declination), -1, 1));
  const ra =
    ((24 * 60) / Math.PI) *
    SOLAR_CONSTANT *
    dr *
    (omega * Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.sin(omega));

  return { ra, daylightHours: (24 / Math.PI) * omega };
}

/**
 * Uslonecznienie rzeczywiste n (h) odwrocone z rownania Angstroma Rs = (a + b n/N) Ra. Przyblizenie dla wzoru IUNG,
 * ktory potrzebuje godzin slonca, a zrodla siatkowe podaja promieniowanie.
 */
export function sunshineHoursFromRadiation(solarMjM2: number, latitude: number, doy: number): number {
  const { ra, daylightHours } = solarGeometry(latitude, doy);

  if (ra <= 0) return 0;

  return clamp(((solarMjM2 / ra - ANGSTROM_A) / ANGSTROM_B) * daylightHours, 0, daylightHours);
}

export interface PenmanMonteithInput {
  tMinC: number;
  tMaxC: number;
  /** promieniowanie calkowite Rs (MJ m-2 d-1) */
  solarMjM2: number;
  /** rzeczywiste cisnienie pary wodnej ea (kPa) */
  actualVapourPressureKPa: number;
  /** predkosc wiatru na 2 m (m/s) */
  windMs: number;
  elevationM: number;
  latitude: number;
  doy: number;
}

/** ET0 Penman-Monteith (mm/d), rownanie 6; strumien ciepla glebowego dla doby G = 0. */
export function penmanMonteithEt0(input: PenmanMonteithInput): number {
  const { tMinC, tMaxC, solarMjM2, actualVapourPressureKPa: ea, windMs, elevationM, latitude, doy } = input;
  const tMean = (tMinC + tMaxC) / 2;
  const pressure = 101.3 * ((293 - 0.0065 * elevationM) / 293) ** 5.26;
  const gamma = 0.000665 * pressure;
  const delta = (4098 * saturationVapourPressure(tMean)) / (tMean + 237.3) ** 2;
  const es = (saturationVapourPressure(tMaxC) + saturationVapourPressure(tMinC)) / 2;
  const { ra } = solarGeometry(latitude, doy);
  const clearSky = (0.75 + 2e-5 * elevationM) * ra;
  const netShortwave = (1 - ALBEDO) * solarMjM2;
  const relativeShortwave = clearSky > 0 ? clamp(solarMjM2 / clearSky, 0.3, 1) : 1;
  const netLongwave =
    STEFAN_BOLTZMANN *
    (((tMaxC + 273.16) ** 4 + (tMinC + 273.16) ** 4) / 2) *
    (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0))) *
    (1.35 * relativeShortwave - 0.35);
  const netRadiation = netShortwave - netLongwave;
  const et0 =
    (0.408 * delta * netRadiation + gamma * (900 / (tMean + 273)) * windMs * Math.max(es - ea, 0)) /
    (delta + gamma * (1 + 0.34 * windMs));

  return Math.max(et0, 0);
}

/** ET0 Hargreaves (mm/d), rownanie 52 - gdy brakuje promieniowania, wilgotnosci albo wiatru. */
export function hargreavesEt0(input: {
  date: string;
  latitude: number;
  tMinC: number;
  tMaxC: number;
}): number {
  const { ra } = solarGeometry(input.latitude, dayOfYear(input.date));
  const tMean = (input.tMinC + input.tMaxC) / 2;
  const range = Math.max(input.tMaxC - input.tMinC, 0);

  return Math.max(0.0023 * (tMean + 17.8) * Math.sqrt(range) * 0.408 * ra, 0);
}

/**
 * ET0 dla dnia serii: Penman-Monteith, gdy sa wszystkie wejscia (ea z sredniej wilgotnosci wzglednej, rownanie
 * 19), inaczej Hargreaves; null, gdy brakuje temperatur. Wartosc podana przez zrodlo ma pierwszenstwo.
 */
export function dailyEt0(
  day: DailyWeather,
  latitude: number,
  elevationM: number,
): { et0Mm: number; method: Et0Method } | null {
  const { tMinC, tMaxC } = day;

  if (day.et0Mm !== null) return { et0Mm: day.et0Mm, method: 'fao56_penman_monteith' };

  if (tMinC === null || tMaxC === null) return null;

  const solar = day.solarMjM2 ?? null;
  const humidity = day.humidityPct ?? null;
  const wind = day.windMs ?? null;

  if (solar === null || humidity === null || wind === null) {
    return { et0Mm: hargreavesEt0({ date: day.date, latitude, tMinC, tMaxC }), method: 'hargreaves' };
  }

  const es = (saturationVapourPressure(tMaxC) + saturationVapourPressure(tMinC)) / 2;

  return {
    et0Mm: penmanMonteithEt0({
      tMinC,
      tMaxC,
      solarMjM2: solar,
      actualVapourPressureKPa: (clamp(humidity, 0, 100) / 100) * es,
      windMs: wind,
      elevationM,
      latitude,
      doy: dayOfYear(day.date),
    }),
    method: 'fao56_penman_monteith',
  };
}
