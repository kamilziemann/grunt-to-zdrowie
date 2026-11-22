/**
 * Serwery i stan lokalny e2e (sciezki wzgledem apps/web). Jeden serwer = strony + API pod /api (jedyny Worker), wiec
 * API e2e to `${BASE_URL}/api`. Stan D1 jest swiezy przy kazdym uruchomieniu (playwright.config.ts) i wspolny dla
 * wszystkich specow; pomocniki e2e pisza do niego przez `wrangler d1 execute --local --persist-to`.
 */
export const WEB_PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `${BASE_URL}/api`;

export const E2E_API_STATE = '.wrangler/e2e-state';
