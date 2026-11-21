// Port geokodera: adres albo nazwa miejsca -> punkty na mapie. Implementacja: infrastructure/nominatim
// (OpenStreetMap); mozna ja podmienic na geokoder GUGiK bez zmian w serwisie.
export interface PlaceRecord {
  id: string;
  label: string;
  detail: string;
  center: [lng: number, lat: number];
  bbox: [west: number, south: number, east: number, north: number];
}

export interface PlaceSource {
  search(query: string, limit: number): Promise<PlaceRecord[]>;
}
