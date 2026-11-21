// Publiczne API feature "parcels": wybor dzialek ewidencyjnych na mapie i po numerze (pierwszy krok analizy wodnej).
// Dane ida z /api/parcels (zrodlo: ULDK GUGiK). Trasy (`routes/{-$locale}/_app/index.tsx`, `analiza.tsx`) importuja
// tylko stad.
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
export { AnalysisSummary, type AnalysisSummaryProps } from './components/analysis-summary';
export { ParcelsScreen, type ParcelsScreenProps } from './components/parcels-screen';
export { useSelectedParcels, type SelectedParcel, type SelectedParcels } from './hooks/use-selected-parcels';
export { validateParcelSearch, type ParcelSearchError } from './schemas/parcel-search.schema';
