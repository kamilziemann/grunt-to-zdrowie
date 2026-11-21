// Klasy BDOT10k, ktore importujemy, i ich mapowanie na rodzaje obiektow w tabeli `bdot_hydro`. Zrodlo: krajowe pliki
// GeoParquet GUGiK (schemat 2021, uklad PL-1992 / EPSG:2180), po jednym pliku na klase obiektow.
// Kody `kind` sa czescia umowy z adapterem w apps/server - nie zmieniaj istniejacych, dopisuj nowe.
export const BDOT_BASE_URL = 'https://opendata.geoportal.gov.pl/bdot10k/schemat2021/GeoParquet/';
export const BDOT_SRID = 2180;

export const HYDRO_KIND = {
  ditch: 1,
  river: 2,
  stream: 3,
  canal: 4,
  standingWater: 5,
  flowingWater: 6,
  wetland: 7,
  bog: 8,
} as const;

export type HydroKind = (typeof HYDRO_KIND)[keyof typeof HYDRO_KIND];

export interface HydroLayer {
  id: 'ditches' | 'watercourses' | 'canals' | 'waters' | 'wetlands';
  /** nazwa pliku bez rozszerzenia = kod klasy BDOT10k */
  file: string;
  /** kolumny atrybutow potrzebne do klasyfikacji (geometria i nazwa sa czytane zawsze) */
  attributes: readonly string[];
  hasName: boolean;
  kinds: readonly HydroKind[];
  /** rodzaj obiektu albo null, gdy obiekt pomijamy */
  classify: (row: Readonly<Record<string, unknown>>) => HydroKind | null;
}

// Odcinki skanalizowane (w rurze) nie zatrzymuja wody na polu i nie da sie na nich postawic zastawki.
const underground = (row: Readonly<Record<string, unknown>>): boolean => row.POLOZENIE === 'pod powierzchnią';

export const HYDRO_LAYERS: readonly HydroLayer[] = [
  {
    id: 'ditches',
    file: 'OT_SWRM_L',
    attributes: ['POLOZENIE'],
    hasName: false,
    kinds: [HYDRO_KIND.ditch],
    classify: (row) => (underground(row) ? null : HYDRO_KIND.ditch),
  },
  {
    id: 'watercourses',
    file: 'OT_SWRS_L',
    attributes: ['POLOZENIE', 'RODZAJ'],
    hasName: true,
    kinds: [HYDRO_KIND.river, HYDRO_KIND.stream],
    classify: (row) => {
      if (underground(row)) return null;

      return row.RODZAJ === 'rzeka' ? HYDRO_KIND.river : HYDRO_KIND.stream;
    },
  },
  {
    id: 'canals',
    file: 'OT_SWKN_L',
    attributes: ['POLOZENIE'],
    hasName: true,
    kinds: [HYDRO_KIND.canal],
    classify: (row) => (underground(row) ? null : HYDRO_KIND.canal),
  },
  {
    id: 'waters',
    file: 'OT_PTWP_A',
    attributes: ['RODZAJ'],
    hasName: true,
    kinds: [HYDRO_KIND.standingWater, HYDRO_KIND.flowingWater],
    classify: (row) => {
      if (row.RODZAJ === 'woda stojąca') return HYDRO_KIND.standingWater;
      if (row.RODZAJ === 'woda płynąca') return HYDRO_KIND.flowingWater;

      // wody morskie nie sa zrodlem retencji dla pola
      return null;
    },
  },
  {
    id: 'wetlands',
    file: 'OT_OIMK_A',
    attributes: ['RODZAJ'],
    hasName: false,
    kinds: [HYDRO_KIND.wetland, HYDRO_KIND.bog],
    classify: (row) => (row.RODZAJ === 'bagno' ? HYDRO_KIND.bog : HYDRO_KIND.wetland),
  },
];
