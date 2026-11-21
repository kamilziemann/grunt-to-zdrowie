// Trasa odczytu zapisanego raportu dla OpenAPI: raport otwiera sie z linku bez ponownej analizy.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse, notFound, validationFailed } from '../../lib/openapi';
import { reportIdParam, storedReportDto } from './reports.schemas';

export const getReport = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['reports'],
  summary: 'Zapisany raport wodny po identyfikatorze (meta.reportId)',
  request: { params: reportIdParam },
  responses: {
    200: jsonResponse(storedReportDto, 'Raport w postaci z chwili analizy'),
    400: validationFailed,
    404: notFound,
  },
});
