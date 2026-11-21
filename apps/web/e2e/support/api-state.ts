/**
 * Serwery i stan lokalny e2e (sciezki wzgledem apps/web). Jeden serwer = strony + API pod /api (jedyny Worker), wiec
 * API e2e to `${BASE_URL}/api`. Stan D1 jest swiezy przy kazdym uruchomieniu (playwright.config.ts) i wspolny dla
 * specow projektu `chromium`; pomocniki e2e pisza do niego przez `wrangler d1 execute --local --persist-to`.
 */
export const WEB_PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `${BASE_URL}/api`;

/** Drugi serwer z wlaczonym auth (projekt `auth`): wlasny port i wlasna D1. */
export const AUTH_WEB_PORT = Number(process.env.E2E_AUTH_PORT ?? WEB_PORT + 1);
export const AUTH_BASE_URL = `http://localhost:${AUTH_WEB_PORT}`;

export const E2E_API_STATE = '.wrangler/e2e-state';
export const E2E_AUTH_STATE = '.wrangler/e2e-auth-state';
