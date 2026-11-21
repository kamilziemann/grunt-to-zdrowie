// Trasa obrazu kondycji roslin pola (NDVI Sentinel-2) dla OpenAPI.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse, notFound, problemResponse, validationFailed } from '../../lib/openapi';
import { vegetationImageryDto, vegetationQuery } from './imagery.schemas';

export const getVegetation = createRoute({
  method: 'get',
  path: '/vegetation',
  tags: ['imagery'],
  summary: 'Kondycja roslin (NDVI) wybranych dzialek z najczystszego zdjecia Sentinel-2 z 30 dni przed data',
  request: { query: vegetationQuery },
  responses: {
    200: jsonResponse(vegetationImageryDto, 'Obraz pola z zasiegiem i dniem zdjecia'),
    400: validationFailed,
    404: notFound,
    502: problemResponse('Copernicus Data Space albo ULDK nie odpowiedzialy'),
    503: problemResponse('Brak kluczy Copernicus Data Space na tym wdrozeniu'),
  },
});
