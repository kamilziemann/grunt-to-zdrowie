// Rachunek wody w strefie korzeni (report.waterLedger) od 21 marca roku analizy do daty analizy: zapas na starcie
// + opad - zuzycie (ETc adj) - przesiakanie ponizej korzeni = zapas na koniec, osobno niedobor wzgledem potrzeb.
// Start 21 marca (poczatek okresu progow IUNG) jest wspolny dla wszystkich upraw i zgodny z KBW "od 21.03"; przed
// siewem uprawy jarej "zuzycie" to parowanie z gleby (Kc 0,35 w bilansie). Zapas liczymy dla glebokosci korzeni
// z dnia konca - model zaklada, ze warstwa, w ktora korzenie wrastaja, jest przy pojemnosci polowej, wiec ta woda
// "byla" tam od poczatku i rownanie zamyka sie co do milimetra. Splywu po powierzchni model nie liczy.
import type { WaterLedger } from '@app/contracts';

import { isoDate, yearOf } from '../iso-date';
import type { RootZoneDay } from '../root-zone-balance';

const round = (value: number): number => Number(value.toFixed(1));

/** Poczatek rachunku: 21 marca roku daty analizy. */
export function ledgerStart(date: string): string {
  return isoDate(yearOf(date), 3, 21);
}

/**
 * Rachunek od `ledgerStart(date)` do `date`. Gdy strefa korzeni sie kurczy (zbior uprawy jarej - korzenie wracaja
 * do warstwy wierzchniej), rachunek konczy sie dzien wczesniej: dalej woda "znikalaby" razem z korzeniami. Null przed
 * 21 marca albo bez dnia poprzedzajacego start w symulacji.
 */
export function waterLedger(days: readonly RootZoneDay[], date: string): WaterLedger | null {
  const from = ledgerStart(date);
  const startIndex = days.findIndex((day) => day.date === from);
  const before = days[startIndex - 1];

  if (date < from || startIndex < 1 || !before) return null;

  let precipitation = 0;
  let lost = 0;
  let shortfall = 0;
  let missing = 0;
  let last: RootZoneDay | undefined;

  for (const day of days.slice(startIndex)) {
    if (day.date > date || (last && day.totalAvailableMm < last.totalAvailableMm)) break;

    precipitation += day.precipMm ?? 0;
    lost += day.deepPercolationMm;

    if (day.kc !== null) shortfall += day.potentialEtcMm - day.actualEtcMm;

    if (day.precipMm === null) missing += 1;

    last = day;
  }

  if (!last) return null;

  const capacity = last.totalAvailableMm;
  const startStorage = round(capacity - before.depletionMm);
  const endStorage = round(capacity - last.depletionMm);
  const precipitationMm = round(precipitation);
  const lostBelowRootsMm = round(lost);

  return {
    from,
    to: last.date,
    startStorageMm: startStorage,
    precipitationMm,
    // z rownania na liczbach zaokraglonych, zeby wykres sie domykal: rowna sumie ETc adj (z przycieciem do punktu
    // wiedniecia) z dokladnoscia do zaokraglen
    cropUseMm: round(Math.max(startStorage + precipitationMm - lostBelowRootsMm - endStorage, 0)),
    lostBelowRootsMm,
    endStorageMm: endStorage,
    shortfallMm: round(Math.max(shortfall, 0)),
    ...(missing > 0 ? { missingWeatherDays: missing } : {}),
  };
}
