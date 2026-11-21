// Trasa kafli otoczenia pola (warstwy drzew, sieci wodnej i obszarow chronionych na mapie) dla OpenAPI.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse, problemResponse, validationFailed } from '../../lib/openapi';
import { contextTileDto, contextTileQuery } from './context.schemas';

export const getContextTile = createRoute({
  method: 'get',
  path: '/tile',
  tags: ['context'],
  summary:
    'Otoczenie pola z BDOT10k w kaflu XYZ (poziom 14): drzewa, budowle i waly, obszary chronione; przyciete do kafla, WGS84',
  request: { query: contextTileQuery },
  responses: {
    200: jsonResponse(contextTileDto, 'Obiekty warstwy przecinajace kafel'),
    400: validationFailed,
    502: problemResponse('Baza otoczenia pola (PostGIS) nie odpowiedziala albo odpowiedziala blednie'),
    503: problemResponse('Baza otoczenia pola nie jest skonfigurowana (DATABASE_URL)'),
  },
});
