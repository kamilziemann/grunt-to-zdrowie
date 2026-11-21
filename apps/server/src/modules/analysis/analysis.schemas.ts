// Schematy OpenAPI modulu analysis - kontrakty z @app/contracts z nazwami komponentow (`.meta({ id })`, zod 4).
import { analysisRequestSchema, waterReportSchema } from '@app/contracts';

export const analysisRequestBody = analysisRequestSchema.meta({ id: 'AnalysisRequest' });
export const waterReportDto = waterReportSchema.meta({ id: 'WaterReport' });
