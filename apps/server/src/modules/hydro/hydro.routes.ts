// Trasa kafli hydrografii (warstwa "woda w otoczeniu" na mapie) dla OpenAPI.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse, problemResponse, validationFailed } from '../../lib/openapi';
import { hydroTileDto, hydroTileQuery } from './hydro.schemas';

export const getHydroTile = createRoute({
  method: 'get',
  path: '/tile',
  tags: ['hydro'],
  summary: 'Rowy, cieki, kanaly, wody i mokradla BDOT10k w kaflu XYZ (poziom 14), przyciete do kafla, WGS84',
  request: { query: hydroTileQuery },
  responses: {
    200: jsonResponse(hydroTileDto, 'Obiekty przecinajace kafel'),
    400: validationFailed,
    502: problemResponse('Baza hydrografii (PostGIS) nie odpowiedziala albo odpowiedziala blednie'),
    503: problemResponse('Baza hydrografii nie jest skonfigurowana (DATABASE_URL)'),
  },
});
