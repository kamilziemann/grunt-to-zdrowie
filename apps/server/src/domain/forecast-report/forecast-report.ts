// Prognoza do raportu (report.forecast): dni z MET Norway, ktore silnik juz pobiera dla analizy "na dzis". Dla dat
// historycznych prognozy nie ma (orkiestrator jej nie pobiera), wiec nie ma tez pola - nie udajemy, ze ja znamy.
import type { Forecast, SourceRef } from '@app/contracts';

import type { ForecastSeries } from '../analysis-ports';

export function forecastReport(series: ForecastSeries | null, source: SourceRef | null): Forecast | null {
  if (!series || series.days.length === 0 || !source) return null;

  const issuedAt = series.issuedAt ?? source.fetchedAt;

  return {
    days: series.days.map((day) => ({
      date: day.date,
      ...(day.precipMm === null ? {} : { precipitationMm: Math.max(day.precipMm, 0) }),
      ...(day.tMaxC === null ? {} : { tMaxC: day.tMaxC }),
      ...(day.tMinC === null ? {} : { tMinC: day.tMinC }),
      ...(day.et0Mm === null ? {} : { et0Mm: day.et0Mm }),
    })),
    source: source.provider,
    ...(issuedAt ? { issuedAt } : {}),
  };
}
