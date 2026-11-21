// Port czyszczenia cache'u brzegowego (Workers Cache). Odpowiedzi publiczne niosa tagi z @app/cache; po zmianie
// danych czyscimy tagi tego, co sie zmienilo. Implementacja: infrastructure/edge-cache (cache.purge z runtime'u).
export interface EdgeCachePurger {
  /** Czysci odpowiedzi z danymi tagami; blad jest logowany, nie przerywa zapisu (dane juz zmienione). */
  purge(tags: readonly string[]): Promise<void>;
}

/** Purger, ktory nic nie robi (testy, srodowisko bez Workers Cache) - zapamietuje wywolania do asercji. */
export function createRecordingPurger(): EdgeCachePurger & { readonly calls: string[][] } {
  const calls: string[][] = [];

  return {
    calls,
    purge: async (tags) => {
      calls.push([...tags]);
    },
  };
}
