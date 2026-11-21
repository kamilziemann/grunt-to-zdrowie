// Rejestr wywolania API w procesie. Wejscie Workera (jedyne miejsce, ktore importuje kod serwera) rejestruje raz na
// izolat funkcje `Request -> Response` (Hono z env i waitUntil). Klient API po stronie serwera bierze ja stad, wiec
// zaden plik wspoldzielony z przegladarka nie importuje backendu - kod serwera nie trafia do bundla klienta.
export type ServerFetch = (request: Request) => Promise<Response>;

let registered: ServerFetch | undefined;

export function registerServerFetch(fetch: ServerFetch): void {
  registered = fetch;
}

export function getServerFetch(): ServerFetch {
  if (!registered) {
    throw new Error(
      'Brak registerServerFetch(): wejscie Workera musi zarejestrowac API przed renderem stron.',
    );
  }

  return registered;
}
