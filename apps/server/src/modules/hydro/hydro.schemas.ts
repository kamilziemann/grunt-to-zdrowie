// Schematy OpenAPI modulu hydro - kontrakty z @app/contracts z nazwami komponentow (`.meta({ id })`, zod 4).
import { hydroTileQuerySchema, hydroTileSchema } from '@app/contracts';

export const hydroTileDto = hydroTileSchema.meta({ id: 'HydroTile' });
export const hydroTileQuery = hydroTileQuerySchema;
