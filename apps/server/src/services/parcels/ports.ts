// Port zrodla dzialek widziany przez serwis. Definicja zyje w domain (implementuje ja infrastructure/uldk,
// a infrastruktura nie importuje serwisow); serwis zna tylko ten interfejs.
export type {
  ParcelDescription,
  ParcelMatches,
  ParcelRecord,
  ParcelSource,
} from '../../domain/parcel-source';
export type { ParcelOutlineSource } from '../../domain/parcel-outline-source';
