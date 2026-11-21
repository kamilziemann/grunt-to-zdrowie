// Porty zrodel danych silnika analizy i ksztalt danych, ktore oddaja. Implementacje: infrastructure/* (pakiety
// P1 meteo, P3 gleba, P4 teren, P5 woda i otoczenie, P6 satelita); do czasu ich powstania -
// infrastructure/sample-sources (dane przykladowe, oznaczone `sample`).
//
// Umowa dla kazdego zrodla: "nie ma danych" to odpowiedz, nie wyjatek - `data: null` i `source.status: 'missing'`
// z powodem w `note`. Limit czasu i nieoczekiwane bledy lapie orkiestrator (services/analysis).
import type { FieldArea, SoilCategory, SourceRef } from '@app/contracts';

export interface Sourced<T> {
  data: T | null;
  source: SourceRef;
}

export type LngLat = [lng: number, lat: number];

export interface DailyWeather {
  date: string;
  precipMm: number | null;
  tMinC: number | null;
  tMaxC: number | null;
  tMeanC: number | null;
  /** ewapotranspiracja wskaznikowa FAO-56, gdy zrodlo ja podaje; inaczej liczy ja domain/evapotranspiration */
  et0Mm: number | null;
  solarMjM2?: number | null;
  humidityPct?: number | null;
  windMs?: number | null;
}

/** Dobowa pogoda dla punktu, ciagla i rosnaca po dacie. */
export interface MeteoSeries {
  days: DailyWeather[];
  /** bok komorki siatki zrodla w km - pogoda jest wspolna dla calego pola */
  gridKm: number;
  elevationM?: number;
}

export interface ForecastSeries {
  days: {
    date: string;
    precipMm: number | null;
    et0Mm: number | null;
    tMinC: number | null;
    tMaxC: number | null;
  }[];
}

export interface SoilProfile {
  sandPct: number;
  siltPct: number;
  clayPct: number;
  organicMatterPct: number;
  /** wilgotnosc objetosciowa przy polowej pojemnosci wodnej i w punkcie trwalego wiedniecia (m3/m3) */
  fieldCapacity: number;
  wiltingPoint: number;
  /** woda dostepna dla roslin w mm na metr profilu */
  availableWaterMmPerM: number;
  /** kategoria podatnosci na susze wg IUNG; null, gdy nie da sie jej ustalic */
  category: SoilCategory | null;
  /** zakres prawdopodobnych kategorii, gdy pewnosc jest niska (np. sama klasa bonitacyjna) */
  categoryRange?: [SoilCategory, SoilCategory];
  basis: 'texture' | 'land_use' | 'both';
  /** grupa granulometryczna (np. "pg" = piasek gliniasty), z ktorej wynika kategoria */
  textureClass?: string;
  /** woda dostepna w calym profilu do 1,5 m (mm) - tej glebokosci dotycza kategorie IUNG */
  availableWaterProfileMm?: number;
  /** zrodlo jest modelem (np. globalny SoilGrids 250 m), a nie pomiarem ani mapa glebowa */
  modelled?: boolean;
}

/** Siatka wysokosci w ukladzie metrycznym; komorki wierszami od polnocnego zachodu. */
export interface TerrainGrid {
  /** uklad wspolrzednych siatki, np. "EPSG:2180" */
  crs: string;
  /** wspolrzedne lewego gornego naroznika */
  originX: number;
  originY: number;
  cellSizeM: number;
  cols: number;
  rows: number;
  elevationM: number[];
}

export interface TerrainData {
  grid: TerrainGrid;
  /** statystyki dla pola (pochodne siatki liczy domain/terrain - pakiet P4) */
  summary: {
    elevationMinM: number;
    elevationMaxM: number;
    slopeMeanPct: number;
    /** udzial powierzchni pola o nachyleniu powyzej 5% */
    slopeShareAbove5Pct: number;
    /** liczba zaglebien bezodplywowych w polu */
    depressions: number;
  };
}

export type HydroFeatureKind = 'watercourse' | 'ditch' | 'water_body' | 'wetland';

export interface HydroContext {
  /** promien przeszukania wokol pola; "brak w promieniu" to nie "brak danych" */
  searchRadiusM: number;
  /** odleglosc od granicy pola; null = brak w promieniu przeszukania */
  nearestWatercourseM: number | null;
  nearestDitchM: number | null;
  waterBodies: number;
  wetlands: number;
  /** obiekty w promieniu (do mapy i regul); linie i obrysy w WGS84 */
  features: { kind: HydroFeatureKind; coordinates: LngLat[] }[];
  /** udzial drzew i zadrzewien w otoczeniu pola, 0-1; null = brak danych o pokryciu terenu */
  treeCoverShare: number | null;
  /** odleglosc do najblizszej wody stojacej i mokradla; null = brak w promieniu */
  nearestWaterBodyM?: number | null;
  nearestWetlandM?: number | null;
  /** liczba odcinkow rowow w promieniu i laczna dlugosc rowow wewnatrz pola (m) */
  ditchesInRadius?: number;
  ditchLengthInFieldM?: number;
  /** nazwa najblizszego cieku, gdy BDOT10k ja podaje */
  nearestWatercourseName?: string | null;
}

export interface VegetationObservation {
  date: string;
  ndvi: number | null;
  ndmi: number | null;
  /** udzial czystych pikseli pola, 0-1 */
  validShare: number;
  pixels: number;
}

export interface VegetationSeries {
  /** obserwacje w oknie wokol daty analizy, od najnowszej */
  observations: VegetationObservation[];
  /** ta sama pora roku w poprzednich latach - po jednej obserwacji na rok */
  baseline: (VegetationObservation & { year: number })[];
  cellSizeM: number;
}

export interface MeteoSource {
  /** Pogoda dobowa dla punktu, od `from` do `to` wlacznie. */
  series(point: LngLat, from: string, to: string): Promise<Sourced<MeteoSeries>>;
}

export interface ForecastSource {
  /** Prognoza od dnia `from` na `days` dni; dla dat historycznych zrodlo oddaje `missing`. */
  forecast(point: LngLat, from: string, days: number): Promise<Sourced<ForecastSeries>>;
}

export interface SoilSource {
  profile(field: FieldArea): Promise<Sourced<SoilProfile>>;
}

export interface TerrainSource {
  terrain(field: FieldArea): Promise<Sourced<TerrainData>>;
}

export interface HydroSource {
  context(field: FieldArea): Promise<Sourced<HydroContext>>;
}

export interface VegetationSource {
  series(field: FieldArea, date: string): Promise<Sourced<VegetationSeries>>;
}

/** Komplet zrodel danych silnika. */
export interface DataSources {
  meteo: MeteoSource;
  forecast: ForecastSource;
  soil: SoilSource;
  terrain: TerrainSource;
  hydro: HydroSource;
  vegetation: VegetationSource;
}
