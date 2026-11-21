// @app/cache - wspolny jezyk cache'u brzegowego (Workers Cache) dla stron i API: tagi, polityki, naglowki.
// Czyste funkcje bez zaleznosci od runtime'u; samo czyszczenie (`cache.purge`) robi adapter w apps/server.
export * from './headers';
export * from './policies';
export * from './tags';
