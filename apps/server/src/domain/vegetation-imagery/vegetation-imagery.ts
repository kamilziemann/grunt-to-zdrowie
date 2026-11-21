// Port obrazu kondycji roslin (NDVI z Sentinel-2) dla pola: dzialki + dzien -> pokolorowane obrazy przyciete do dzialek.
// Implementacja: infrastructure/copernicus-imagery (Copernicus Data Space). Serwis nie zna formatu zapytan uslugi.
import type { BoundingBox, PolygonGeometry } from '../parcel-geometry';

/** Jedna dzialka pola: obraz powstaje osobno dla kazdej (sasiednie dzialki razem nie sa poprawnym MultiPolygonem). */
export interface VegetationImagePart {
  geometry: PolygonGeometry;
  /** zasieg obrazu w WGS84 - narozniki obrazu na mapie */
  bbox: BoundingBox;
}

export interface VegetationImageRequest {
  parts: readonly VegetationImagePart[];
  /** ostatni dzien okna wyszukiwania sceny (RRRR-MM-DD) */
  date: string;
  /** ile dni wstecz od `date` szukamy sceny */
  windowDays: number;
}

export interface VegetationTile {
  /** PNG: kolor = NDVI na wspolnej skali `ndviLow..ndviHigh`, piksele poza dzialka i pod chmura przezroczyste */
  png: Uint8Array;
  bbox: BoundingBox;
}

export interface VegetationImage {
  /** obrazy w kolejnosci `parts` */
  tiles: VegetationTile[];
  /** dzien wykonania zdjecia satelitarnego (RRRR-MM-DD) */
  sceneDate: string;
  /** zachmurzenie calej sceny Sentinel-2 w procentach (z katalogu) */
  sceneCloudCover: number;
  /** czesc pola widoczna bez chmur (0..1) */
  clearShare: number;
  /** NDVI odpowiadajacy poczatkowi i koncowi skali kolorow (5. i 95. percentyl w polu, min. rozpietosc) */
  ndviLow: number;
  ndviHigh: number;
  ndviMean: number;
}

export interface VegetationImagerySource {
  /** null = w oknie nie ma sceny, na ktorej pole jest widoczne bez chmur */
  render(request: VegetationImageRequest): Promise<VegetationImage | null>;
}
