// Klasy BDOT10k, ktore importujemy, i ich mapowanie na rodzaje obiektow w tabelach `bdot_hydro` (woda: rowy, cieki,
// wody, mokradla) i `bdot_context` (otoczenie pola: lasy i zadrzewienia, budowle pietrzace, waly, obszary chronione).
// Zrodlo: krajowe pliki GeoParquet GUGiK (schemat 2021, uklad PL-1992 / EPSG:2180), po jednym pliku na klase.
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

/**
 * Rodzaje w tabeli `bdot_context`. Numeracja osobna od `HYDRO_KIND` (od 20), zeby kodu z jednej tabeli nie dalo sie
 * pomylic z kodem z drugiej.
 */
export const CONTEXT_KIND = {
  forest: 20,
  grove: 21,
  woodland: 22,
  treeRow: 23,
  hedge: 24,
  weir: 30,
  dam: 31,
  lock: 32,
  levee: 40,
  natura2000: 50,
  landscapePark: 51,
  nationalPark: 52,
  natureReserve: 53,
} as const;

export type ContextKind = (typeof CONTEXT_KIND)[keyof typeof CONTEXT_KIND];

export type BdotTable = 'bdot_hydro' | 'bdot_context';

type Row = Readonly<Record<string, unknown>>;

export interface BdotLayer<Kind extends number = number> {
  id: string;
  /** tabela docelowa; woda i otoczenie sa rozdzielone, zeby lasy nie spowalnialy kafli hydrografii */
  table: BdotTable;
  /** nazwy plikow bez rozszerzenia = kody klas BDOT10k (linie i poligony tej samej klasy to osobne pliki) */
  files: readonly string[];
  /** kolumny atrybutow potrzebne do klasyfikacji (geometria i nazwa sa czytane zawsze) */
  attributes: readonly string[];
  hasName: boolean;
  kinds: readonly Kind[];
  /** tolerancja uproszczenia w metrach, gdy inna niz domyslna (duze poligony o malo waznym przebiegu granicy) */
  toleranceM?: number;
  /** rodzaj obiektu albo null, gdy obiekt pomijamy */
  classify: (row: Row) => Kind | null;
}

export type HydroLayer = BdotLayer<HydroKind> & {
  id: 'ditches' | 'watercourses' | 'canals' | 'waters' | 'wetlands';
};

// Odcinki skanalizowane (w rurze) nie zatrzymuja wody na polu i nie da sie na nich postawic zastawki.
const underground = (row: Row): boolean => row.POLOZENIE === 'pod powierzchnią';

export const HYDRO_LAYERS: readonly HydroLayer[] = [
  {
    id: 'ditches',
    table: 'bdot_hydro',
    files: ['OT_SWRM_L'],
    attributes: ['POLOZENIE'],
    hasName: false,
    kinds: [HYDRO_KIND.ditch],
    classify: (row) => (underground(row) ? null : HYDRO_KIND.ditch),
  },
  {
    id: 'watercourses',
    table: 'bdot_hydro',
    files: ['OT_SWRS_L'],
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
    table: 'bdot_hydro',
    files: ['OT_SWKN_L'],
    attributes: ['POLOZENIE'],
    hasName: true,
    kinds: [HYDRO_KIND.canal],
    classify: (row) => (underground(row) ? null : HYDRO_KIND.canal),
  },
  {
    id: 'waters',
    table: 'bdot_hydro',
    files: ['OT_PTWP_A'],
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
    table: 'bdot_hydro',
    files: ['OT_OIMK_A'],
    attributes: ['RODZAJ'],
    hasName: false,
    kinds: [HYDRO_KIND.wetland, HYDRO_KIND.bog],
    classify: (row) => (row.RODZAJ === 'bagno' ? HYDRO_KIND.bog : HYDRO_KIND.wetland),
  },
];

// Obiekt zniszczony albo dopiero budowany nie pietrzy wody i nie chroni pola - nie ma czego "sprawdzic w terenie".
const defunct = (row: Row): boolean =>
  row.KATEGORIAISTNIENIA === 'zniszczony' || row.KATEGORIAISTNIENIA === 'w budowie';

function damming(row: Row): ContextKind | null {
  if (defunct(row)) return null;
  if (row.RODZAJ === 'jaz') return CONTEXT_KIND.weir;
  if (row.RODZAJ === 'zapora') return CONTEXT_KIND.dam;
  if (row.RODZAJ === 'śluza') return CONTEXT_KIND.lock;

  return null;
}

// Granica obszaru chronionego sluzy tylko do pytania "czy pole lezy w obszarze albo tuz obok" - 20 m wystarcza.
const PROTECTED_TOLERANCE_M = 20;

const protectedArea = (id: string, file: string, kind: ContextKind): BdotLayer<ContextKind> => ({
  id,
  table: 'bdot_context',
  files: [file],
  attributes: [],
  hasName: true,
  kinds: [kind],
  toleranceM: PROTECTED_TOLERANCE_M,
  classify: () => kind,
});

export const CONTEXT_LAYERS: readonly BdotLayer<ContextKind>[] = [
  {
    id: 'forests',
    table: 'bdot_context',
    files: ['OT_PTLZ_A'],
    attributes: ['RODZAJ'],
    hasName: false,
    kinds: [CONTEXT_KIND.forest, CONTEXT_KIND.grove, CONTEXT_KIND.woodland],
    // granica lasu na zdjeciu lotniczym i tak jest umowna; 5 m zmniejsza tabele kilka razy
    toleranceM: 5,
    classify: (row) => {
      if (row.RODZAJ === 'las') return CONTEXT_KIND.forest;
      if (row.RODZAJ === 'zagajnik') return CONTEXT_KIND.grove;
      if (row.RODZAJ === 'zadrzewienie') return CONTEXT_KIND.woodland;

      return null;
    },
  },
  {
    id: 'tree-rows',
    table: 'bdot_context',
    files: ['OT_OIPR_L'],
    attributes: ['RODZAJ'],
    hasName: false,
    kinds: [CONTEXT_KIND.treeRow, CONTEXT_KIND.hedge],
    classify: (row) => {
      if (row.RODZAJ === 'rząd drzew') return CONTEXT_KIND.treeRow;
      if (row.RODZAJ === 'pas krzewów lub żywopłot') return CONTEXT_KIND.hedge;

      // linie oddzialowe w lesie, progi skalne i wodospady nie sa zadrzewieniem srodpolnym
      return null;
    },
  },
  {
    id: 'structures',
    table: 'bdot_context',
    files: ['OT_BUHD_L', 'OT_BUHD_A'],
    attributes: ['RODZAJ', 'KATEGORIAISTNIENIA'],
    hasName: false,
    kinds: [CONTEXT_KIND.weir, CONTEXT_KIND.dam, CONTEXT_KIND.lock],
    classify: damming,
  },
  {
    id: 'levees',
    table: 'bdot_context',
    files: ['OT_BUZM_L'],
    attributes: ['RODZAJ', 'KATEGORIAISTNIENIA'],
    hasName: false,
    kinds: [CONTEXT_KIND.levee],
    // nasypy drogowe i suche wykopy nie zatrzymuja wody dla pola
    classify: (row) =>
      !defunct(row) && row.RODZAJ === 'wał przeciwpowodziowy lub grobla' ? CONTEXT_KIND.levee : null,
  },
  protectedArea('natura2000', 'OT_TCON_A', CONTEXT_KIND.natura2000),
  protectedArea('landscape-parks', 'OT_TCPK_A', CONTEXT_KIND.landscapePark),
  protectedArea('national-parks', 'OT_TCPN_A', CONTEXT_KIND.nationalPark),
  protectedArea('nature-reserves', 'OT_TCRZ_A', CONTEXT_KIND.natureReserve),
];

/** Wszystkie klasy, ktore zna skrypt importu (`--layers` wybiera sposrod nich po `id`). */
export const BDOT_LAYERS: readonly BdotLayer[] = [...HYDRO_LAYERS, ...CONTEXT_LAYERS];
