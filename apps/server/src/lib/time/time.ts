// Czas i zaokraglenia - czyste funkcje bez zaleznosci.

export function nowIso(): string {
  return new Date().toISOString();
}

/** Zaokraglenie do `digits` miejsc po przecinku (np. czasy scen do 0.1 s). */
export function round(value: number, digits = 1): number {
  const f = 10 ** digits;

  return Math.round(value * f) / f;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
