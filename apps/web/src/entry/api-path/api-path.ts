// Granica API w jednym Workerze: wszystko pod /api nalezy do Hono (trasy serwera sa bez prefiksu: /me, /articles,
// /auth/*), wiec prefiks odcinamy przed przekazaniem zapytania. Reszta sciezek to strony TanStack Start.
export const API_PREFIX = '/api';

export function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/** To samo zapytanie (metoda, naglowki, cialo, sygnal) ze sciezka bez /api. */
export function toApiRequest(request: Request): Request {
  const url = new URL(request.url);

  url.pathname = url.pathname.slice(API_PREFIX.length) || '/';

  return new Request(url, request);
}
