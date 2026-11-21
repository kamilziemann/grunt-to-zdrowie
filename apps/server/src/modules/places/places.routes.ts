// Trasa wyszukiwania miejsc po adresie albo nazwie (geokodowanie) dla OpenAPI.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse, problemResponse, validationFailed } from '../../lib/openapi';
import { placeSearchQuery, placeSearchResultDto } from './places.schemas';

export const searchPlaces = createRoute({
  method: 'get',
  path: '/search',
  tags: ['places'],
  summary: 'Miejsca w Polsce po adresie albo nazwie (punkt i zasieg do dojazdu mapy)',
  request: { query: placeSearchQuery },
  responses: {
    200: jsonResponse(placeSearchResultDto, 'Znalezione miejsca'),
    400: validationFailed,
    502: problemResponse('Geokoder nie odpowiedzial albo odpowiedzial blednie'),
  },
});
