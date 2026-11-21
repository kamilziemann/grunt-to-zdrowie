// Katalog jedynego Workera (apps/web): tam jest wrangler.jsonc i lokalny stan D1 (`bun run dev`), wiec
// `wrangler d1 execute` w skryptach serwera biegnie stamtad - skrypt trafia do tej samej bazy, ktora czyta strona.
import { resolve } from 'node:path';

export const WORKER_DIR = resolve(import.meta.dirname, '../../web');
