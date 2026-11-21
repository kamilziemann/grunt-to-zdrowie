// Schematy OpenAPI modulu places - kontrakty z @app/contracts z nazwami komponentow.
import { placeSearchQuerySchema, placeSearchResultSchema } from '@app/contracts';

export const placeSearchQuery = placeSearchQuerySchema;
export const placeSearchResultDto = placeSearchResultSchema.meta({ id: 'PlaceSearchResult' });
