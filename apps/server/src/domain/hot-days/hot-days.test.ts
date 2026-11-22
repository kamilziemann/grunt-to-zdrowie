import type { Assessment, Cause } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { DailyWeather } from '../analysis-ports';
import { addDays } from '../iso-date';
import { clearlyHotterThanUsual, hotDays, hotDaysEvidence, withHotDays } from './hot-days';

const day = (date: string, tMaxC: number | null): DailyWeather => ({
  date,
  precipMm: 0,
  tMinC: null,
  tMaxC,
  tMeanC: null,
  et0Mm: null,
});

/** Ciagla seria od `from` do `to`; `tMax(date)` mowi, jaka temperatura w danym dniu. */
function series(from: string, to: string, tMax: (date: string) => number | null): DailyWeather[] {
  const days: DailyWeather[] = [];

  for (let date = from; date <= to; date = addDays(date, 1)) days.push(day(date, tMax(date)));

  return days;
}

/** Upal w wybranych dniach, poza nimi 22°C. */
const hotOn = (dates: readonly string[]) => (date: string) => (dates.includes(date) ? 31.5 : 22);

describe('hotDays', () => {
  it('okno 30 dni przechodzi przez przelom miesiecy i obejmuje dzien analizy; 30,0°C to jeszcze nie upal', () => {
    const days = series(
      '2019-05-01',
      '2019-06-30',
      hotOn(['2019-05-31', '2019-06-01', '2019-06-16', '2019-06-17', '2019-06-30', '2019-05-30']),
    );

    days.push(day('2019-07-01', 35));
    days.find((entry) => entry.date === '2019-06-20')!.tMaxC = 30;

    // 30 dni: 2019-06-01..2019-06-30 (5/30 poza oknem, 7/1 po dacie analizy); 14 dni: od 17 czerwca
    expect(hotDays(days, '2019-06-30')).toMatchObject({ last14: 2, last30: 4 });
    // okno przez przelom miesiecy: 2019-05-03..2019-06-01
    expect(hotDays(days, '2019-06-01')).toMatchObject({ last14: 3, last30: 3 });
  });

  it('braki danych: liczy z dni, ktore sa; ponizej polowy dni z danymi - brak wyniku', () => {
    const gappy = series('2018-05-01', '2018-06-15', (date) =>
      date >= '2018-06-05' && date <= '2018-06-10' ? null : date === '2018-06-12' ? 33 : 20,
    );
    const empty = series('2018-05-01', '2018-06-15', (date) => (date >= '2018-06-03' ? null : 33));

    expect(hotDays(gappy, '2018-06-15')).toMatchObject({ last14: 1, last30: 1 });
    // 13 dni bez danych z 14 - za malo; z 30 dni dane ma 17 (17 maja - 2 czerwca, >= 15), wszystkie upalne
    expect(hotDays(empty, '2018-06-15')).toMatchObject({ last14: null, last30: 17 });
  });

  it('norma: srednia z tych samych dni w 10 poprzednich latach', () => {
    // co rok upal 10 i 11 czerwca, a w roku 2013 dodatkowo 1 czerwca -> (9*2 + 3) / 10 = 2,1
    const days = series('2008-01-01', '2018-06-15', (date) =>
      date.slice(5) === '06-10' || date.slice(5) === '06-11' || date === '2013-06-01' ? 32 : 18,
    );

    expect(hotDays(days, '2018-06-15')).toEqual({ last14: 2, last30: 2, normal30: 2.1, backgroundYears: 10 });
  });

  it('niepelne tlo: norma z dostepnych lat (min. 5; tu 6), przy krotszym tle - bez normy', () => {
    const sixYears = series('2012-05-01', '2018-06-15', hotOn(['2014-06-10', '2015-06-10', '2018-06-10']));
    const fourYears = series('2014-05-01', '2018-06-15', hotOn([]));

    expect(hotDays(sixYears, '2018-06-15')).toMatchObject({ normal30: 0.3, backgroundYears: 6 });
    expect(hotDays(fourYears, '2018-06-15')).toMatchObject({ normal30: null, backgroundYears: 4 });
  });

  it('29 lutego: rok bez przestepnego dnia bierze 28 lutego', () => {
    const days = series('2010-01-01', '2020-02-29', () => 5);

    expect(hotDays(days, '2020-02-29')).toEqual({ last14: 0, last30: 0, normal30: 0, backgroundYears: 10 });
  });
});

describe('clearlyHotterThanUsual', () => {
  it('co najmniej o 3 dni i dwa razy tyle co norma', () => {
    const at = (last30: number, normal30: number | null) =>
      clearlyHotterThanUsual({ last14: 0, last30, normal30, backgroundYears: 10 });

    expect(at(8, 2.1)).toBe(true);
    expect(at(4, 1)).toBe(true);
    expect(at(3, 1)).toBe(false);
    expect(at(9, 5)).toBe(false);
    expect(at(10, null)).toBe(false);
  });
});

describe('hotDaysEvidence', () => {
  it('trzy miary z nota o siatce 50 km; norma jako odniesienie i osobna miara', () => {
    const evidence = hotDaysEvidence(
      { last14: 5, last30: 8, normal30: 2.1, backgroundYears: 9 },
      '2019-06-30',
    );

    expect(evidence.map((item) => [item.metric, item.value, item.reference])).toEqual([
      ['hot_days_14d', 5, undefined],
      ['hot_days_30d', 8, 2.1],
      ['hot_days_30d_normal', 2.1, undefined],
    ]);
    expect(evidence[0]?.note).toContain('50 km');
    expect(evidence[2]?.note).toContain('2009–2018 (z 9 lat z danymi)');
  });

  it('bez normy - bez odniesienia i bez miary normy', () => {
    const evidence = hotDaysEvidence(
      { last14: 1, last30: 2, normal30: null, backgroundYears: 3 },
      '2019-06-30',
    );

    expect(evidence.map((item) => item.metric)).toEqual(['hot_days_14d', 'hot_days_30d']);
    expect(evidence[1]?.reference).toBeUndefined();
  });
});

describe('withHotDays', () => {
  const assessment = { level: 'risk' } as Assessment;
  const demand: Cause = {
    id: 'high_evaporative_demand',
    weight: 0.4,
    evidence: [{ metric: 'et_period', value: 300, unit: 'mm', reference: 250, source: 'meteo' }],
  };
  const soil: Cause = {
    id: 'low_soil_retention',
    weight: 0.6,
    evidence: [{ metric: 'available_water_mm_per_m', value: 90, unit: 'mm/m', source: 'soil' }],
  };
  // co rok 1 dzien upalny w oknie, w roku analizy 8
  const hotYear = (heat: number) =>
    series('2008-01-01', '2018-06-15', (date) => {
      if (date.startsWith('2018'))
        return date >= '2018-06-01' && date < addDays('2018-06-01', heat) ? 32 : 20;

      return date.slice(5) === '06-10' ? 32 : 20;
    });

  it('przy przyczynie "duze parowanie" dowody ida do niej, ocena i wagi bez zmian', () => {
    const result = withHotDays(hotYear(2), '2018-06-15', assessment, [soil, demand]);

    expect(result.assessment).toBe(assessment);
    expect(result.causes[1]?.evidence.map((item) => item.metric)).toEqual([
      'et_period',
      'hot_days_14d',
      'hot_days_30d',
      'hot_days_30d_normal',
    ]);
    expect(result.causes.map((cause) => cause.weight)).toEqual([0.6, 0.4]);
  });

  it('bez przyczyny: dowody w ocenie tylko przy upalach wyraznie czestszych niz zwykle', () => {
    const hot = withHotDays(hotYear(8), '2018-06-15', assessment, [soil]);
    const usual = withHotDays(hotYear(2), '2018-06-15', assessment, [soil]);

    expect(hot.assessment.level).toBe('risk');
    expect(hot.assessment.evidence?.map((item) => item.metric)).toEqual([
      'hot_days_14d',
      'hot_days_30d',
      'hot_days_30d_normal',
    ]);
    expect(hot.causes).toEqual([soil]);
    expect(usual.assessment).toBe(assessment);
  });

  it('bez pogody (albo pogoda z atrapy) nic nie dodaje', () => {
    expect(withHotDays(undefined, '2018-06-15', assessment, [demand])).toEqual({
      assessment,
      causes: [demand],
    });
  });
});
