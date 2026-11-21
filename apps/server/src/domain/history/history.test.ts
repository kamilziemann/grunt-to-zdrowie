import type { CropId, FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { DailyWeather, MeteoSeries } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { addDays, addYears, daysBetween, yearOf } from '../iso-date';
import { history } from './history';

const FIELD: FieldArea = {
  id: 'area:test',
  kind: 'drawn',
  parcelIds: [],
  label: '',
  geometry: { type: 'Polygon', coordinates: [] },
  centroid: [21.56, 52.17],
  bbox: [21.56, 52.17, 21.563, 52.172],
  areaHa: 5,
};

/** Co drugi rok suchy (lata parzyste), pozostale wilgotne (`wetPrecipMm` opadu na dobe). */
function alternatingYears(date: string, wetPrecipMm = 4): MeteoSeries {
  const from = addDays(addYears(date, -10), -120);

  return {
    gridKm: 55,
    days: Array.from({ length: daysBetween(from, date) + 1 }, (_unused, index): DailyWeather => {
      const day = addDays(from, index);
      const dry = yearOf(day) % 2 === 0;

      return {
        date: day,
        precipMm: dry ? 0.4 : wetPrecipMm,
        tMinC: dry ? 15 : 12,
        tMaxC: dry ? 30 : 25,
        tMeanC: dry ? 22.5 : 18.5,
        et0Mm: dry ? 5 : 3,
        solarMjM2: dry ? 23 : 19,
        humidityPct: 70,
        windMs: 2.5,
      };
    }),
  };
}

function input(cropId: CropId, meteo: MeteoSeries | null): StageInput {
  const date = '2026-07-15';

  return {
    field: FIELD,
    cropId,
    date,
    crop: cropAtDate(cropId, date),
    meteo,
    forecast: null,
    soil: {
      sandPct: 60,
      siltPct: 25,
      clayPct: 15,
      organicMatterPct: 2,
      fieldCapacity: 0.208,
      wiltingPoint: 0.105,
      availableWaterMmPerM: 103,
      category: 2,
      basis: 'texture',
    },
    terrain: null,
    hydro: null,
    vegetation: null,
  };
}

describe('history', () => {
  it('10 sezonow przed data analizy, jeden glos na sezon: susza w 5 suchych latach z 10', () => {
    const result = history(input('winter_wheat', alternatingYears('2026-07-15')));

    expect(result.seasons.map((season) => season.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(result.seasonsWithData).toBe(10);
    expect(result.droughtSeasons).toBe(5);
    expect(result.calendar).toHaveLength(140);
    expect(result.seasons.find((season) => season.year === 2018)?.droughtPeriods).toBeGreaterThan(0);
    expect(result.seasons.find((season) => season.year === 2021)?.droughtPeriods).toBe(0);
    expect(result.riskMonths.length).toBeGreaterThan(0);
  });

  it('nadmiar wody w okresach wilgotnych lat i kalendarz biezacego roku do dnia analizy', () => {
    // wilgotne lata: 7 mm opadu na dobe, KBW okresu wyraznie powyzej +50 mm
    const result = history(input('winter_wheat', alternatingYears('2026-07-15', 7)));
    const wet = result.calendar.filter((item) => item.year === 2021 && item.excess);
    const dry = result.calendar.filter((item) => item.year === 2020 && item.excess);

    expect(wet.length).toBeGreaterThan(0);
    expect(dry).toHaveLength(0);
    // okresy 2026 zakonczone najpozniej 15 lipca (okres 6 konczy sie 10 lipca), osobno od 10 pelnych sezonow
    expect(result.currentCalendar?.map((item) => [item.year, item.periodNo])).toEqual(
      [1, 2, 3, 4, 5, 6].map((no) => [2026, no]),
    );
    expect(result.calendar.some((item) => item.year === 2026)).toBe(false);
    expect(result.deficitSeasons).toBeGreaterThanOrEqual(result.droughtSeasons);
  });

  it('suche lata maja dni stresu i niedobor wody w strefie korzeni, wilgotne - nie', () => {
    const result = history(input('winter_wheat', alternatingYears('2026-07-15')));
    const dry = result.seasons.find((season) => season.year === 2018);
    const wet = result.seasons.find((season) => season.year === 2021);

    expect(dry?.stressDays).toBeGreaterThan(30);
    expect(dry?.etDeficitMm).toBeGreaterThan(50);
    expect(wet).toMatchObject({ stressDays: 0, etDeficitMm: 0 });
  });

  it('okresy bez progu dla uprawy (x w tabeli) sa nieoceniane, a nie "ok"', () => {
    const result = history(input('winter_wheat', alternatingYears('2026-07-15')));
    const august = result.calendar.filter((item) => item.periodNo >= 10).map((item) => item.status);

    expect(new Set(august)).toEqual(new Set(['not_monitored']));
  });

  it('uzytki zielone: bez progow IUNG, miesiace ryzyka z bilansu strefy korzeniowej', () => {
    const result = history(input('grassland', alternatingYears('2026-07-15')));

    expect(result.droughtSeasons).toBe(0);
    expect(result.seasons.every((season) => season.monitoredPeriods === 0)).toBe(true);
    expect(result.riskMonths.length).toBeGreaterThan(0);
  });

  it('bez pogody kazdy okres jest "missing", a sezonow z danymi nie ma', () => {
    const result = history(input('winter_wheat', null));

    expect(result.seasonsWithData).toBe(0);
    expect(new Set(result.calendar.map((item) => item.status))).toEqual(new Set(['missing']));
    expect(result.seasons[0]).toMatchObject({ stressDays: null, minBalanceMm: null });
  });
});
