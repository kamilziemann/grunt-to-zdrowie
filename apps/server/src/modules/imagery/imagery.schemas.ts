// Schematy OpenAPI modulu imagery - kontrakty z @app/contracts z nazwami komponentow (`.meta({ id })`, zod 4).
import { vegetationImageryQuerySchema, vegetationImagerySchema } from '@app/contracts';

export const vegetationQuery = vegetationImageryQuerySchema;
export const vegetationImageryDto = vegetationImagerySchema.meta({ id: 'VegetationImagery' });
