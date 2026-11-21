// Schematy OpenAPI modulu parcels - kontrakty z @app/contracts z nazwami komponentow (`.meta({ id })`, zod 4).
import {
  parcelAtQuerySchema,
  parcelBoundariesSchema,
  parcelBoundaryTileQuerySchema,
  parcelByIdQuerySchema,
  parcelSchema,
  parcelSearchQuerySchema,
  parcelSearchResultSchema,
} from '@app/contracts';

export const parcelDto = parcelSchema.meta({ id: 'Parcel' });
export const parcelSearchResultDto = parcelSearchResultSchema.meta({ id: 'ParcelSearchResult' });
export const parcelSearchQuery = parcelSearchQuerySchema;
export const parcelByIdQuery = parcelByIdQuerySchema;
export const parcelAtQuery = parcelAtQuerySchema;
export const parcelBoundariesDto = parcelBoundariesSchema.meta({ id: 'ParcelBoundaries' });
export const parcelBoundaryTileQuery = parcelBoundaryTileQuerySchema;
