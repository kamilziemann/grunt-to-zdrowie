// Porty serwisu obrazow pola: zrodlo obrazu kondycji roslin (definicja w domain, implementacja
// infrastructure/copernicus-imagery) i dzialki (serwis parcels - geometria po identyfikatorze).
import type { Parcel } from '@app/contracts';

export type {
  VegetationImage,
  VegetationImageRequest,
  VegetationImagerySource,
} from '../../domain/vegetation-imagery';

export interface ParcelGeometryLookup {
  get(id: string): Promise<Parcel>;
}
