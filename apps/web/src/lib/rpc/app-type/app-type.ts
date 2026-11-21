// Jedyne miejsce, ktore zna typ aplikacji serwera. Eksport `@app/server/types` (package.json serwera) wskazuje
// apps/server/src/types.ts, wiec nie potrzeba wpisu w tsconfig `paths` (Next/SWC wymaga zreszta jednej sciezki na wpis).
// To import typu: nic z serwera nie trafia do bundla strony.
import type { AppType } from '@app/server/types';

export type { AppType };
