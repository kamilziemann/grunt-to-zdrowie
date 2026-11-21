// Miary z dowodow (`evidence.metric`), ktore maja nazwe w tlumaczeniach (`report.evidence.metrics`). Silnik moze
// dopisac nowa miare bez zmiany kontraktu - ekran pokaze wtedy jej identyfikator, a test pilnuje zgodnosci listy
// z plikiem komunikatow.
export const REPORT_METRICS = [
  'available_water_mm_per_m',
  'slope_mean_pct',
  'precip_30d',
  'precip_60d',
  'et0_60d',
  'balance_60d',
  'ditch_distance_m',
  'water_distance_m',
  'tree_cover_share',
  'wetland_share',
  'kc',
] as const;

export type ReportMetric = (typeof REPORT_METRICS)[number];
