// @app/config - stale wspoldzielone przez API i web.
// Zasada: tylko wartosci (bez logiki, bez I/O), zeby paczke mogl importowac kazdy runtime.

export const APP_NAME = 'Grunt to Zdrowie';
export const APP_SLUG = 'grunt-to-zdrowie';

/** Domyslne i maksymalne rozmiary stron list (API i web). */
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;
