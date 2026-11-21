// Schematy OpenAPI modulu context - kontrakty z @app/contracts z nazwami komponentow (`.meta({ id })`, zod 4).
import { contextTileQuerySchema, contextTileSchema } from '@app/contracts';

export const contextTileDto = contextTileSchema.meta({ id: 'ContextTile' });
export const contextTileQuery = contextTileQuerySchema;
