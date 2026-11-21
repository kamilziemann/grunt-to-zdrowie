// Trasa analizy wodnej pola dla OpenAPI. POST, bo wynik zalezy od tresci zadania (pole, uprawa, data) i nie jest
// odczytem do cache brzegowego; powtarzalnosc raportu zapewni zapis po stronie serwisu (pakiet I1).
import { createRoute } from '@hono/zod-openapi';

import { jsonBody, jsonResponse, notFound, problemResponse, validationFailed } from '../../lib/openapi';
import { analysisRequestBody, waterReportDto } from './analysis.schemas';

export const analyzeField = createRoute({
  method: 'post',
  path: '/',
  tags: ['analysis'],
  summary: 'Analiza wodna pola: ocena, historia 10 lat, przyczyny, zalecenia, zrodla i ograniczenia',
  request: { body: jsonBody(analysisRequestBody) },
  responses: {
    200: jsonResponse(waterReportDto, 'Raport wodny pola'),
    400: validationFailed,
    404: notFound,
    502: problemResponse('Nie udalo sie pobrac granic dzialki (ULDK / WFS GUGiK)'),
  },
});
