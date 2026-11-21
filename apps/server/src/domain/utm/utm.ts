// Odwzorowanie UTM na elipsoidzie WGS84 (szeregi Krugera do trzeciego rzedu, ponizej 1 mm w pasie strefy). W UTM leza
// piksele Sentinel-2 (strefy 33-35 w Polsce), wiec siatka komorek pola w UTM pokrywa sie z pikselami bez
// przeprobkowania. Wzory: Karney (2011), "Transverse Mercator with an accuracy of a few nanometers", rozdz. 4.

const A = 6_378_137;
const F = 1 / 298.257_223_563;
const K0 = 0.9996;
const FALSE_EASTING = 500_000;

const N = F / (2 - F);
const RECTIFYING_RADIUS = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const ALPHA = [
  N / 2 - (2 / 3) * N ** 2 + (5 / 16) * N ** 3,
  (13 / 48) * N ** 2 - (3 / 5) * N ** 3,
  (61 / 240) * N ** 3,
] as const;
const BETA = [
  N / 2 - (2 / 3) * N ** 2 + (37 / 96) * N ** 3,
  (1 / 48) * N ** 2 + (1 / 15) * N ** 3,
  (17 / 480) * N ** 3,
] as const;
const DELTA = [
  2 * N - (2 / 3) * N ** 2 - 2 * N ** 3,
  (7 / 3) * N ** 2 - (8 / 5) * N ** 3,
  (56 / 15) * N ** 3,
] as const;
const ECCENTRICITY = Math.sqrt(F * (2 - F));

const RAD = Math.PI / 180;

/** Strefa UTM dla dlugosci geograficznej (bez wyjatkow Norwegii i Svalbardu - Polska ich nie dotyczy). */
export function utmZone(lng: number): number {
  return Math.min(60, Math.max(1, Math.floor((lng + 180) / 6) + 1));
}

/** Kod EPSG strefy na polkuli polnocnej (np. 34 -> 32634). */
export const utmEpsg = (zone: number): number => 32_600 + zone;

const centralMeridian = (zone: number): number => (zone - 1) * 6 - 180 + 3;

/** [dlugosc, szerokosc] WGS84 -> [easting, northing] w metrach w strefie `zone` (polkula polnocna). */
export function toUtm(lng: number, lat: number, zone: number): [number, number] {
  const phi = lat * RAD;
  const lambda = (lng - centralMeridian(zone)) * RAD;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - ECCENTRICITY * Math.atanh(ECCENTRICITY * Math.sin(phi)));
  const xi0 = Math.atan2(t, Math.cos(lambda));
  const eta0 = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
  let xi = xi0;
  let eta = eta0;

  for (const [index, alpha] of ALPHA.entries()) {
    const j = 2 * (index + 1);

    xi += alpha * Math.sin(j * xi0) * Math.cosh(j * eta0);
    eta += alpha * Math.cos(j * xi0) * Math.sinh(j * eta0);
  }

  return [FALSE_EASTING + K0 * RECTIFYING_RADIUS * eta, K0 * RECTIFYING_RADIUS * xi];
}

/** [easting, northing] w strefie `zone` -> [dlugosc, szerokosc] WGS84. */
export function fromUtm(easting: number, northing: number, zone: number): [number, number] {
  const xi = northing / (K0 * RECTIFYING_RADIUS);
  const eta = (easting - FALSE_EASTING) / (K0 * RECTIFYING_RADIUS);
  let xi0 = xi;
  let eta0 = eta;

  for (const [index, beta] of BETA.entries()) {
    const j = 2 * (index + 1);

    xi0 -= beta * Math.sin(j * xi) * Math.cosh(j * eta);
    eta0 -= beta * Math.cos(j * xi) * Math.sinh(j * eta);
  }

  const chi = Math.asin(Math.sin(xi0) / Math.cosh(eta0));
  let phi = chi;

  for (const [index, delta] of DELTA.entries()) phi += delta * Math.sin(2 * (index + 1) * chi);

  const lambda = Math.atan2(Math.sinh(eta0), Math.cos(xi0));

  return [centralMeridian(zone) + lambda / RAD, phi / RAD];
}
