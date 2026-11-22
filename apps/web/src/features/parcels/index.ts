// Publiczne API feature "parcels": wybor dzialek ewidencyjnych na mapie i po numerze (pierwszy krok analizy wodnej).
// Dane ida z /api/parcels (zrodlo: ULDK GUGiK). Trasy (`index.tsx`, `mapa.tsx`, `analiza.tsx`) importuja tylko stad.
export {
  hydroTileQuery,
  parcelQuery,
  parcelSearchQuery,
  parcelsKeys,
  parcelTargetQuery,
  pointTarget,
  type ParcelTarget,
} from './api/parcels.queries';
export { HYDRO_TILES } from './fixtures/hydro-tiles';
export { HomeScreen } from './components/home-screen';
export { ParcelCheck, type ParcelCheckProps } from './components/parcel-check';
export { ParcelsScreen, type ParcelsScreenProps } from './components/parcels-screen';
export { useSelectedParcels, type SelectedParcel, type SelectedParcels } from './hooks/use-selected-parcels';
export {
  formatMapView,
  MAP_DRAW_PARAM,
  mapSearchSchema,
  parseMapView,
  type MapSearch,
} from './schemas/map-search.schema';
export { validateParcelSearch, type ParcelSearchError } from './schemas/parcel-search.schema';
