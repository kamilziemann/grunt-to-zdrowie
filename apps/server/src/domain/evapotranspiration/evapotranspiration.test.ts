import { describe, expect, it } from 'vitest';

import {
  dailyEt0,
  hargreavesEt0,
  penmanMonteithEt0,
  saturationVapourPressure,
  solarGeometry,
  sunshineHoursFromRadiation,
} from './evapotranspiration';

describe('solarGeometry (FAO-56, przyklady 8 i 9)', () => {
  it('3 wrzesnia na 20 stopniach S: Ra = 32,2 MJ/m2/d, N = 11,7 h', () => {
    const { ra, daylightHours } = solarGeometry(-20, 246);

    expect(ra).toBeCloseTo(32.2, 1);
    expect(daylightHours).toBeCloseTo(11.7, 1);
  });

  it('noc polarna nie psuje rachunku (Ra = 0, N = 0)', () => {
    const { ra, daylightHours } = solarGeometry(80, 355);

    expect(ra).toBeCloseTo(0, 6);
    expect(daylightHours).toBeCloseTo(0, 6);
  });
});

describe('penmanMonteithEt0 (FAO-56, przyklad 18 - Bruksela, 6 lipca)', () => {
  // 50 st. 48' N, 100 m n.p.m., Tmax 21,5 C, Tmin 12,3 C, ea 1,409 kPa (z RHmax/RHmin), u2 2,078 m/s,
  // n = 9,25 h -> Rs = 22,07 MJ/m2/d; wynik w publikacji: ET0 = 3,9 mm/d
  it('daje 3,9 mm/d', () => {
    const et0 = penmanMonteithEt0({
      tMinC: 12.3,
      tMaxC: 21.5,
      solarMjM2: 22.07,
      actualVapourPressureKPa: 1.409,
      windMs: 2.078,
      elevationM: 100,
      latitude: 50.8,
      doy: 187,
    });

    expect(et0).toBeCloseTo(3.9, 1);
  });

  it('cisnienie pary nasyconej: e(21,5) = 2,564 kPa, e(12,3) = 1,431 kPa', () => {
    expect(saturationVapourPressure(21.5)).toBeCloseTo(2.564, 3);
    expect(saturationVapourPressure(12.3)).toBeCloseTo(1.431, 3);
  });
});

describe('hargreavesEt0', () => {
  it('15 lipca, 52,17 N, Tmin 12 C, Tmax 26 C: Ra = 40,0 MJ/m2/d -> 5,17 mm/d (przeliczenie reczne)', () => {
    expect(hargreavesEt0({ date: '2018-07-15', latitude: 52.17, tMinC: 12, tMaxC: 26 })).toBeCloseTo(5.17, 2);
  });
});

describe('sunshineHoursFromRadiation', () => {
  it('odwraca rownanie Angstroma: Rs z przykladu 18 daje z powrotem n = 9,25 h', () => {
    expect(sunshineHoursFromRadiation(22.07, 50.8, 187)).toBeCloseTo(9.25, 1);
  });

  it('miesci sie w przedziale 0..N', () => {
    expect(sunshineHoursFromRadiation(0, 52, 180)).toBe(0);
    expect(sunshineHoursFromRadiation(60, 52, 180)).toBeCloseTo(solarGeometry(52, 180).daylightHours, 6);
  });
});

describe('dailyEt0', () => {
  const day = {
    date: '2018-07-15',
    precipMm: 0,
    tMinC: 12,
    tMaxC: 26,
    tMeanC: 19,
    et0Mm: null,
  };

  it('z kompletem danych liczy Penmana-Monteitha, przy braku promieniowania - Hargreavesa', () => {
    const full = dailyEt0({ ...day, solarMjM2: 25, humidityPct: 65, windMs: 2.5 }, 52.17, 120);
    const partial = dailyEt0({ ...day, solarMjM2: null, humidityPct: 65, windMs: 2.5 }, 52.17, 120);

    expect(full?.method).toBe('fao56_penman_monteith');
    expect(full?.et0Mm).toBeGreaterThan(3.5);
    expect(full?.et0Mm).toBeLessThan(6);
    expect(partial).toEqual({ et0Mm: hargreavesEt0({ ...day, latitude: 52.17 }), method: 'hargreaves' });
  });

  it('bez temperatur nie ma ET0, a wartosc ze zrodla ma pierwszenstwo', () => {
    expect(dailyEt0({ ...day, tMaxC: null }, 52, 100)).toBeNull();
    expect(dailyEt0({ ...day, et0Mm: 4.2 }, 52, 100)).toEqual({
      et0Mm: 4.2,
      method: 'fao56_penman_monteith',
    });
  });
});
