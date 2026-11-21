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
] as const;

export type ReportMetric = (typeof REPORT_METRICS)[number];

export function isKnownMetric(metric: string): metric is ReportMetric {
  return (REPORT_METRICS as readonly string[]).includes(metric);
}

export type EvidenceUnit = 'mm' | 'mmPerM' | 'm' | 'm3' | 'ha' | 'percent' | 'days' | 'none';

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
    case 'm3':
      return { value, unit: 'm3' };
    case 'ha':
      return { value, unit: 'ha' };
    case 'days':
    case 'd':
      return { value, unit: 'days' };
    default:
      return { value, unit: 'none' };
  }
}
