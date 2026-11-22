// Miary z dowodow (`evidence.metric`) i ich jednostki, ktore maja nazwe w tlumaczeniach (`report.evidence.*`).
// Silnik moze dopisac nowa miare bez zmiany kontraktu - ekran pokaze wtedy ogolna nazwe ("inny wskaznik"), nigdy
// surowy identyfikator. Test pilnuje zgodnosci list z plikiem komunikatow.
export const REPORT_METRICS = [
  'available_water_mm_per_m',
  'slope_mean_pct',
  'precip_30d',
  'precip_60d',
  'et0_60d',
  'et0_period',
  'balance_60d',
  'balance_period',
  'ditch_distance_m',
  'nearest_ditch_m',
  'water_distance_m',
  'nearest_water_m',
  'nearest_stream_m',
  'tree_cover_share',
  'wetland_share',
  'kc',
  'stress_days_30',
  'depletion_share',
  'ndvi_anomaly',
  'ndmi_anomaly',
  'precip_period',
  'et_period',
  'soil_category',
  'ditch_length_in_field_m',
  'ditches_in_radius',
  'water_bodies_in_radius',
  'wetlands_in_radius',
  'drought_seasons',
  'deficit_seasons',
  'season_et_deficit_median',
  'nearest_wetland_m',
  'organic_matter_pct',
  'registry_soil_class',
  'slope_share_above_5_pct',
  'depression_volume_m3',
  'depression_area_m2',
  // upal przy przyczynie `high_evaporative_demand` (serwer doda je w nastepnej rundzie)
  'hot_days_14d',
  'hot_days_30d',
  'hot_days_30d_normal',
] as const;

/** Miary dni z upalem - ich odniesienie to norma z 10 lat ("zwykle o tej porze"), nie prog. */
export const HEAT_METRICS: readonly string[] = ['hot_days_14d', 'hot_days_30d', 'hot_days_30d_normal'];

export type ReportMetric = (typeof REPORT_METRICS)[number];

export function isKnownMetric(metric: string): metric is ReportMetric {
  return (REPORT_METRICS as readonly string[]).includes(metric);
}

export type EvidenceUnit =
  | 'mm'
  | 'mmPerM'
  | 'm'
  | 'm2'
  | 'm3'
  | 'ha'
  | 'percent'
  | 'days'
  | 'count'
  | 'seasons'
  | 'category'
  | 'soilClass'
  | 'index'
  | 'none';

/**
 * Jak czytac `reference` dowodu: przy liczbie obiektow to promien szukania (w nazwie miary), przy sezonach - z ilu
 * sezonow (w wartosci); pozostale jednostki maja zwykle odniesienie (prog, mediana, norma) w osobnej linii.
 */
export function referenceRole(unit: EvidenceUnit): 'radius' | 'total' | 'reference' {
  if (unit === 'count') return 'radius';

  return unit === 'seasons' ? 'total' : 'reference';
}

/**
 * Wartosc dowodu gotowa do sformatowania: udzial 0-1 (`share`) -> procent, reszta bez zmian; `unit` = klucz
 * tlumaczenia `report.evidence.units`. Nieznana jednostka nie trafia na ekran.
 */
export function evidenceDisplay(value: number, unit: string): { value: number; unit: EvidenceUnit } {
  switch (unit) {
    case 'share':
      return { value: value * 100, unit: 'percent' };
    case '%':
    case 'pct':
      return { value, unit: 'percent' };
    case 'mm':
      return { value, unit: 'mm' };
    case 'mm/m':
      return { value, unit: 'mmPerM' };
    case 'm':
      return { value, unit: 'm' };
    case 'm2':
      return { value, unit: 'm2' };
    case 'm3':
      return { value, unit: 'm3' };
    case 'ha':
      return { value, unit: 'ha' };
    case 'days':
    case 'd':
      return { value, unit: 'days' };
    case 'count':
      return { value, unit: 'count' };
    case 'seasons':
      return { value, unit: 'seasons' };
    case 'category':
      return { value, unit: 'category' };
    case 'class':
      return { value, unit: 'soilClass' };
    case 'index':
      return { value, unit: 'index' };
    default:
      return { value, unit: 'none' };
  }
}

/** Klasa bonitacyjna gleby 1-6 cyframi rzymskimi (silnik podaje najslabsza klase jako liczbe). */
export function romanSoilClass(value: number): string {
  return ['I', 'II', 'III', 'IV', 'V', 'VI'][Math.round(value) - 1] ?? String(value);
}
