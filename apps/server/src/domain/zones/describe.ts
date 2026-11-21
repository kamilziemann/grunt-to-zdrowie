// Opis strefy po polsku dla rolnika: co to za miejsce, gdzie lezy i jak duze jest. Liczby (powierzchnia, spadek,
// wilgotnosc) idza osobno w polach strefy - opis jest skrotem, nie jedynym zrodlem informacji.
import type { Zone } from '@app/contracts';

type Position = NonNullable<Zone['position']>;

const PART: Record<Position, string> = {
  n: 'w północnej części pola',
  ne: 'w północno-wschodniej części pola',
  e: 'we wschodniej części pola',
  se: 'w południowo-wschodniej części pola',
  s: 'w południowej części pola',
  sw: 'w południowo-zachodniej części pola',
  w: 'w zachodniej części pola',
  nw: 'w północno-zachodniej części pola',
  centre: 'w środku pola',
};

/** Koniec pola w dopelniaczu: "od północnego końca". */
export const END: Record<Position, string> = {
  n: 'północnego',
  ne: 'północno-wschodniego',
  e: 'wschodniego',
  se: 'południowo-wschodniego',
  s: 'południowego',
  sw: 'południowo-zachodniego',
  w: 'zachodniego',
  nw: 'północno-zachodniego',
  centre: 'środkowego',
};

const RELIEF: Record<NonNullable<Zone['relief']>, string> = {
  hilltop: 'na wzniesieniu',
  slope: 'na stoku',
  hollow: 'w obniżeniu',
  flat: '',
};

const KIND: Partial<Record<Zone['kind'], string>> = {
  drying: 'Suchsze miejsce',
  collecting: 'Miejsce, gdzie zbiera się woda',
  depression: 'Zagłębienie bez odpływu',
  typical: 'Pozostała część pola',
};

const MOISTURE: Record<NonNullable<Zone['moisture']>, string> = {
  drier: 'suchszy',
  wetter: 'wilgotniejszy',
  typical: 'typowy',
};

/** Powierzchnia "ok. 0,8 ha" (ponizej 0,1 ha - dwa miejsca po przecinku). */
export function approxHectares(areaHa: number): string {
  const digits = areaHa < 0.1 ? 2 : 1;

  return `ok. ${areaHa.toFixed(digits).replace('.', ',')} ha`;
}

const decimal = (value: number, digits = 1): string => value.toFixed(digits).replace('.', ',');

/** Strona swiata wektora (wschod, polnoc) albo srodek, gdy przesuniecie jest male wzgledem rozmiaru pola. */
export function compass(dx: number, dy: number, scale: number): Position {
  if (Math.hypot(dx, dy) < scale * 0.15) return 'centre';

  const sectors: Position[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return sectors[Math.round(((angle + 360) % 360) / 45) % 8] ?? 'centre';
}

/**
 * roznica NDMI wzgledem pola od tej wartosci to wiecej niz roznica wilgotnosci jednej uprawy - czesto inny uzytek
 * albo inny stan pola (laka obok scierniska, zboze obok swiezo zaoranego pasa)
 */
export const OTHER_USE_NDMI_DELTA = 0.15;

const OTHER_USE_NOTE =
  'Tak duża różnica wilgotności roślin może też oznaczać inny użytek albo inny stan pola (np. łąka obok ścierniska) — sprawdź na miejscu.';

/** Zdanie ostroznosci przy duzej roznicy NDMI (strefa ze zdjecia satelitarnego, nie z terenu). */
function otherUseNote(zone: Zone): string {
  return zone.kind !== 'typical' &&
    zone.ndmiDelta !== undefined &&
    Math.abs(zone.ndmiDelta) >= OTHER_USE_NDMI_DELTA
    ? `. ${OTHER_USE_NOTE}`
    : '';
}

/** "Suchsze miejsce na wzniesieniu, w północno-wschodniej części pola, przy rowie, ok. 0,8 ha". */
export function describeZone(zone: Zone): string {
  const parts = [
    [KIND[zone.kind] ?? 'Część pola', zone.relief ? RELIEF[zone.relief] : ''].filter(Boolean).join(' '),
    zone.position && zone.kind !== 'typical' ? PART[zone.position] : '',
    zone.ditchDistanceM !== undefined && zone.ditchDistanceM <= 50 ? 'przy rowie' : '',
    approxHectares(zone.areaHa),
    zone.volumeM3 === undefined ? '' : `pojemność ok. ${Math.round(zone.volumeM3)} m³`,
  ];

  return `${parts.filter(Boolean).join(', ')}${otherUseNote(zone)}`;
}

/** "Odcinek 0–100 m od północnego końca: suchszy, spadek 2,1%, przy rowie". */
export function describeSegment(zone: Zone, start: Position): string {
  const head = `Odcinek ${Math.round(zone.fromM ?? 0)}–${Math.round(zone.toM ?? 0)} m od ${END[start]} końca`;
  const parts = [
    zone.moisture ? MOISTURE[zone.moisture] : '',
    zone.slopePct === undefined ? '' : `spadek ${decimal(zone.slopePct)}%`,
    zone.relief && zone.relief !== 'flat' ? RELIEF[zone.relief] : '',
    zone.ditchDistanceM !== undefined && zone.ditchDistanceM <= 50 ? 'przy rowie' : '',
  ].filter(Boolean);

  return `${parts.length > 0 ? `${head}: ${parts.join(', ')}` : head}${otherUseNote(zone)}`;
}
