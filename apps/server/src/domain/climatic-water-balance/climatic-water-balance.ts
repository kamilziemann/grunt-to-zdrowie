// Klimatyczny bilans wodny (KBW) w rozumieniu IUNG-PIB: opad minus ewapotranspiracja potencjalna (ETP) za okres
// szesciodekadowy, do porownania z progami suszy (domain/iung-thresholds). To miara klimatu, nie uprawy - nie
// mnozymy przez Kc (zapotrzebowanie uprawy liczy bilans strefy korzeniowej FAO-56, domain/root-zone-balance).
//
// ETP liczymy wzorem Doroszewskiego-Gorskiego (1995), uzywanym przez IUNG (mm na miesiac):
//   ETP = -89,6 + 0,0621 t^2 + 0,00448 h^1,66 + 9,1 f
// t - srednia temperatura powietrza [C], h - suma godzin uslonecznienia w miesiacu, f - dlugosc dnia w polowie
// miesiaca [h] (docs/research/2026-11-21-metodyka-uprawy-walidacja.md; wspolczynniki z notatki, nie potwierdzone
// w tekscie zrodlowym). Okresy IUNG skladaja sie z pelnych dekad, wiec liczymy dekadami: dekade przeskalowujemy
// do miesiaca (h x dni miesiaca / dni dekady), liczymy ETP miesieczne i bierzemy z niego czesc dekady. Zrodla
// siatkowe nie podaja uslonecznienia, wiec h odtwarzamy z promieniowania (Angstrom, domain/evapotranspiration).
// Wynik to OSZACOWANIE miary IUNG (siatka meteo ok. 50 km, uslonecznienie z promieniowania) i tak go podpisujemy.
//
// ET0 FAO-56 (Penman-Monteith) daje latem zwykle kilka mm na miesiac mniej niz ETP IUNG (srednia dla Polski:
// czerwiec 108 vs 114 mm) - dlatego KBW liczymy wzorem IUNG, a FAO-56 zostawiamy bilansowi strefy korzeniowej.
import type { DailyWeather } from '../analysis-ports';
import { dailyEt0, solarGeometry, sunshineHoursFromRadiation } from '../evapotranspiration';
import { addDays, dayOfYear, daysBetween, isoDate, monthOf, yearOf } from '../iso-date';

/** Okres liczy sie, gdy dane pokrywaja co najmniej tyle jego dni - niepelny okres zanizalby sumy. */
export const MIN_PERIOD_COVERAGE = 0.9;

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** ETP miesieczne (mm) wzorem Doroszewskiego-Gorskiego; zimowe ujemne wyniki obcinamy do zera. */
export function doroszewskiGorskiEtp(tMeanC: number, sunshineHours: number, dayLengthH: number): number {
  return Math.max(
    -89.6 + 0.0621 * tMeanC ** 2 + 0.00448 * Math.max(sunshineHours, 0) ** 1.66 + 9.1 * dayLengthH,
    0,
  );
}

function daysInMonth(date: string): number {
  return Number(isoDate(yearOf(date), monthOf(date) + 1, 0).slice(8, 10));
}

/** Dekada kalendarzowa zawierajaca dzien: 1-10, 11-20, 21-koniec miesiaca. */
export function decadeOf(date: string): { from: string; to: string } {
  const day = Number(date.slice(8, 10));
  const year = yearOf(date);
  const month = monthOf(date);

  if (day <= 10) return { from: isoDate(year, month, 1), to: isoDate(year, month, 10) };

  if (day <= 20) return { from: isoDate(year, month, 11), to: isoDate(year, month, 20) };

  return { from: isoDate(year, month, 21), to: isoDate(year, month, daysInMonth(date)) };
}

const tMeanOf = (day: DailyWeather): number | null =>
  day.tMeanC ?? (day.tMinC !== null && day.tMaxC !== null ? (day.tMinC + day.tMaxC) / 2 : null);

interface DecadeBalance {
  precipMm: number;
  etpMm: number;
  /** dni z opadem i temperatura */
  knownDays: number;
  days: number;
}

/**
 * Jedna dekada. Gdy czesci dni brakuje, opad i ETP licza sie tylko z dni znanych (obie strony bilansu z tych
 * samych dni). Brak promieniowania w calej dekadzie: ETP z ET0 FAO-56/Hargreavesa tych dni (przyblizenie).
 */
function decadeBalance(days: DailyWeather[], from: string, to: string, latitude: number): DecadeBalance {
  const length = daysBetween(from, to) + 1;
  const known = days.filter((day) => day.precipMm !== null && tMeanOf(day) !== null);
  const precipMm = known.reduce((sum, day) => sum + (day.precipMm ?? 0), 0);

  if (known.length === 0) return { precipMm: 0, etpMm: 0, knownDays: 0, days: length };

  const sunny = known.filter((day) => day.solarMjM2 !== null && day.solarMjM2 !== undefined);

  if (sunny.length === 0) {
    const etpMm = known.reduce((sum, day) => sum + (dailyEt0(day, latitude, 0)?.et0Mm ?? 0), 0);

    return { precipMm, etpMm, knownDays: known.length, days: length };
  }

  const tMean = known.reduce((sum, day) => sum + (tMeanOf(day) ?? 0), 0) / known.length;
  const sunshine =
    sunny.reduce(
      (sum, day) => sum + sunshineHoursFromRadiation(day.solarMjM2 ?? 0, latitude, dayOfYear(day.date)),
      0,
    ) *
    (length / sunny.length);
  const monthDays = daysInMonth(from);
  const midMonth = isoDate(yearOf(from), monthOf(from), 15);
  const monthlyEtp = doroszewskiGorskiEtp(
    tMean,
    sunshine * (monthDays / length),
    solarGeometry(latitude, dayOfYear(midMonth)).daylightHours,
  );
  // ETP dekady, a z niej tylko dni, dla ktorych znamy tez opad
  const etpMm = monthlyEtp * (length / monthDays) * (known.length / length);

  return { precipMm, etpMm, knownDays: known.length, days: length };
}

export interface ClimaticWaterBalance {
  from: string;
  to: string;
  precipMm: number | null;
  evapotranspirationMm: number | null;
  balanceMm: number | null;
  /** udzial dni okresu z danymi, 0-1 */
  coverage: number;
}

/**
 * KBW za okres od `from` do `to` (wlacznie) z serii dobowej - dekadami. Okres powinien zaczynac sie 1., 11. albo
 * 21. dnia miesiaca (jak okresy IUNG); dekady niepelne na brzegach licza sie proporcjonalnie. Null w sumach, gdy
 * dane pokrywaja mniej niz 90% okresu.
 */
export function climaticWaterBalance(
  days: readonly DailyWeather[],
  from: string,
  to: string,
  latitude: number,
): ClimaticWaterBalance {
  const inPeriod = days.filter((day) => day.date >= from && day.date <= to);
  let precip = 0;
  let etp = 0;
  let known = 0;
  let cursor = from;

  while (cursor <= to) {
    const decade = decadeOf(cursor);
    const end = decade.to < to ? decade.to : to;
    const part = decadeBalance(
      inPeriod.filter((day) => day.date >= cursor && day.date <= end),
      cursor,
      end,
      latitude,
    );

    precip += part.precipMm;
    etp += part.etpMm;
    known += part.knownDays;
    cursor = addDays(end, 1);
  }

  const coverage = known / (daysBetween(from, to) + 1);

  if (coverage < MIN_PERIOD_COVERAGE) {
    return {
      from,
      to,
      precipMm: null,
      evapotranspirationMm: null,
      balanceMm: null,
      coverage: round(coverage, 2),
    };
  }

  return {
    from,
    to,
    precipMm: round(precip),
    evapotranspirationMm: round(etp),
    balanceMm: round(precip - etp),
    coverage: round(coverage, 2),
  };
}
