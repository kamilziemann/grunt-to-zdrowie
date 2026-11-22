// Kafle otoczenia pola (GET /api/context/tile, warstwy `cover` i `waterworks`) dla szkicu pola: typowany klient
// `getApi()` i sprawdzenie ksztaltu kontraktem; kafel niedostepny (brak bazy, brak trasy) = pusta warstwa na szkicu.
import { contextTileSchema, type ContextLayer, type ContextTile } from '@app/contracts';
import { unwrap } from '@app/rpc';

import { getApi } from '../api';

export async function fetchContextTile(
  layer: ContextLayer,
  x: number,
  y: number,
  signal?: AbortSignal,
): Promise<ContextTile> {
  const response = await getApi().context.tile.$get(
    { query: { layer, x: String(x), y: String(y) } },
    { init: { signal: signal ?? null } },
  );

  return contextTileSchema.parse(await unwrap<ContextTile>(response));
}
