import type { CropId, FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { DailyWeather, MeteoSeries, SoilProfile } from '../analysis-ports';
import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { addDays, addYears, daysBetween } from '../iso-date';
import { assess, inGrowingSeason } from './assessment';

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

const SOIL: SoilProfile = {
  sandPct: 60,
  siltPct: 25,
  clayPct: 15,
  organicMatterPct: 2,
  fieldCapacity: 0.208,
  wiltingPoint: 0.105,
  availableWaterMmPerM: 103,
  category: 2,
  basis: 'texture',
};

/**
 * Stala letnia pogoda przez 10 lat przed data analizy. `et0Mm` podane wprost steruje bilansem strefy korzeniowej,
 * a KBW liczy ETP wzorem IUNG z temperatur i promieniowania - dzieki temu oba bilanse da sie ustawic osobno.
 */
function weather(date: string, day: Partial<DailyWeather>): MeteoSeries {
  const from = addDays(addYears(date, -10), -120);

  return {
    gridKm: 55,
    elevationM: 120,
    days: Array.from({ length: daysBetween(from, date) + 1 }, (_unused, index) => ({
      date: addDays(from, index),
      precipMm: 2,
      tMinC: 12,
      tMaxC: 25,
      tMeanC: 18.5,
      et0Mm: 3.5,
      solarMjM2: 19,
      humidityPct: 70,
      windMs: 2.5,
      ...day,
    })),
  };
}

function input(
  date: string,
  day: Partial<DailyWeather> | null,
  extra: Partial<StageInput> = {},
  cropId: CropId = 'winter_wheat',
): StageInput {
  return {
    field: FIELD,
    cropId,
    date,
    crop: cropAtDate(cropId, date),
    meteo: day === null ? null : weather(date, day),
    forecast: null,
    soil: SOIL,
    terrain: null,
    hydro: null,
    vegetation: null,
    ...extra,
  };
}

const DRY = { precipMm: 0.4, et0Mm: 5, tMinC: 15, tMaxC: 30, tMeanC: 22.5, solarMjM2: 23 };
const NORMAL = { precipMm: 4, et0Mm: 3 };
const WET = { precipMm: 9, et0Mm: 3 };

describe('assess - tabela przypadkow', () => {
  it('susza: KBW ponizej progu IUNG dla zboz ozimych na glebie II kategorii, stres w strefie korzeni', () => {
    const result = assess(input('2018-07-15', DRY));

    expect(result.level).toBe('drought');
    expect(result.climaticBalance).toMatchObject({
      status: 'ok',
      periodNo: 6,
      periodFrom: '2018-05-11',
      periodTo: '2018-07-10',
      thresholdMm: -186,
      soilCategory: 2,
      belowThreshold: true,
      method: 'iung_dg95',
    });
    expect(result.climaticBalance?.balanceMm).toBeLessThan(-186);
    expect(result.rootZone?.stressCoefficient).toBeLessThan(1);
    expect(result.rootZone?.seasonStressDays).toBeGreaterThan(30);
  });

  it('norma: opad pokrywa potrzeby, KBW powyzej progu i bez stresu', () => {
    const result = assess(input('2021-07-15', NORMAL));

    expect(result.level).toBe('ok');
    expect(result.climaticBalance?.belowThreshold).toBe(false);
    expect(result.rootZone).toMatchObject({ stressCoefficient: 1, stressDays30: 0 });
  });

  it('nadmiar: KBW wyraznie dodatni przy pelnym profilu', () => {
    expect(assess(input('2021-07-15', WET)).level).toBe('excess');
  });

  it('zima: progi nie obowiazuja, ale zapas wody w strefie korzeni jest podany', () => {
    const result = assess(input('2025-11-21', NORMAL));

    expect(result.level).toBe('out_of_season');
    expect(result.climaticBalance).toMatchObject({
      status: 'out_of_season',
      periodNo: null,
      thresholdMm: null,
    });
    expect(result.rootZone?.totalAvailableMm).toBeGreaterThan(0);
  });

  it('przedwiosnie (przed 20 maja): KBW za 60 dni bez progu, poziom z bilansu strefy korzeniowej', () => {
    const result = assess(input('2018-05-10', DRY, {}, 'spring_barley'));

    expect(inGrowingSeason('2018-05-10')).toBe(true);
    expect(result.climaticBalance).toMatchObject({
      status: 'out_of_season',
      periodNo: null,
      periodTo: '2018-05-10',
    });
    expect(result.level).not.toBe('out_of_season');
  });

  it('brak pogody = brak oceny z niska pewnoscia', () => {
    const result = assess(input('2018-07-15', null));

    expect(result).toMatchObject({
      level: 'unknown',
      confidence: 'low',
      climaticBalance: null,
      rootZone: null,
    });
  });

  it('nieznana gleba: wszystkie kategorie licza sie osobno, a zgodny werdykt zostaje z niska pewnoscia', () => {
    const result = assess(input('2018-07-15', { ...DRY, precipMm: 0 }, { soil: null }));

    expect(result.level).toBe('drought');
    expect(result.rootZone).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.climaticBalance?.categoryScenarios?.map((item) => item.belowThreshold)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('sprzeczne sygnaly (KBW susza, korzenie bez niedoboru) obnizaja pewnosc', () => {
    const agreeing = assess(input('2018-07-15', DRY));
    const conflicting = assess(input('2018-07-15', { ...DRY, et0Mm: 0.3, precipMm: 0.6 }));

    expect(conflicting.level).toBe('drought');
    expect(conflicting.rootZone?.stressCoefficient).toBe(1);
    expect(['medium', 'low']).toContain(agreeing.confidence);
    expect(conflicting.confidence).toBe('low');
  });

  it('uzytki zielone nie maja progow IUNG - KBW bez progu, ocena z bilansu strefy korzeniowej', () => {
    const result = assess(input('2018-07-15', DRY, {}, 'grassland'));

    expect(result.climaticBalance).toMatchObject({
      status: 'not_monitored',
      thresholdMm: null,
      belowThreshold: null,
    });
    expect(result.level).toBe('risk');
  });

  it('pozycja KBW na tle tych samych okresow z 10 lat', () => {
    const result = assess(input('2018-07-15', DRY));

    expect(result.climaticBalance?.rankInHistory).toEqual({ rank: expect.any(Number), years: 11 });
  });
});
