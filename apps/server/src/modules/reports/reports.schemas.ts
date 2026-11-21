// Schematy OpenAPI modulu reports - kontrakty z @app/contracts z nazwami komponentow (`.meta`, zod 4).
import { reportIdParamSchema, waterReportSchema } from '@app/contracts';

export const reportIdParam = reportIdParamSchema.extend({
  id: reportIdParamSchema.shape.id.meta({ param: { name: 'id', in: 'path' }, example: 'r-1a2b3c4d' }),
});
export const storedReportDto = waterReportSchema.meta({ id: 'WaterReport' });
