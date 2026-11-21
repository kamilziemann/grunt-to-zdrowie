// Setup kazdego pliku testowego: stosuje migracje D1 (wczytane w vitest.config.ts) na swiezej bazie w pamieci.
// Izolacja per plik: pool @cloudflare/vitest-plugin uruchamia kazdy plik testowy w nowym runnerze z wlasna instancja
// Miniflare bez `persist`, wiec D1 (i inne bindingi) zaczynaja puste w kazdym pliku. Na tym polegaja testy, ktore
// licza cale tabele albo je czyszcza; w obrebie pliku testy dziela baze i ida po kolei.
import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
