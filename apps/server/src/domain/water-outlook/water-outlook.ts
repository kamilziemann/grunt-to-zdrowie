// Dane "Pogodynki wody" w jednym miejscu: zbiornik wody teraz, prognoza, rachunek wody od 21 marca, ostatnie 60 dni
// bilansu i zdjecia satelitarne. Liczone z tego, co silnik juz pobral (jedna symulacja bilansu strefy korzeniowej na
// raport), bez wplywu na ocene. Brak danych = brak pola.
import type { SourceRef, WaterReport } from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import { dailyWaterSeries } from '../daily-water-series';
import { forecastReport } from '../forecast-report';
import { vegetationSeriesReport } from '../vegetation-series';
import { rootZoneSimulation } from '../water-indicators';
import { waterLedger } from '../water-ledger';
import { waterNow } from '../water-now';

export type WaterOutlook = Pick<
  WaterReport,
  'waterNow' | 'forecast' | 'waterLedger' | 'dailySeries' | 'vegetationSeries'
>;

export function waterOutlook(input: StageInput, forecastSource: SourceRef | null = null): WaterOutlook {
  const days = rootZoneSimulation(input)?.days ?? [];
  const now = waterNow({ cropId: input.cropId, date: input.date, days, forecast: input.forecast });
  const forecast = forecastReport(input.forecast, forecastSource);
  const ledger = waterLedger(days, input.date);
  const daily = now ? dailyWaterSeries(days, input.date) : [];
  const vegetation = vegetationSeriesReport(input.vegetation, input.date);

  return {
    ...(now ? { waterNow: now } : {}),
    ...(forecast ? { forecast } : {}),
    ...(ledger ? { waterLedger: ledger } : {}),
    ...(daily.length > 0 ? { dailySeries: daily } : {}),
    ...(vegetation ? { vegetationSeries: vegetation } : {}),
  };
}
