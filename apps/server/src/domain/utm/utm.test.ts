import { describe, expect, it } from 'vitest';

import { fromUtm, toUtm, utmEpsg, utmZone } from './utm';

describe('UTM', () => {
  it('strefy w Polsce: 33 na zachod od 18 st., 34 do 24 st.', () => {
    expect([14.5, 17.99, 18, 21, 23.9, 24.1].map(utmZone)).toEqual([33, 33, 34, 34, 34, 35]);
    expect(utmEpsg(34)).toBe(32_634);
  });

  it('poludnik srodkowy: easting 500 km; rownik: northing 0', () => {
    expect(toUtm(21, 0, 34)).toEqual([500_000, 0]);
    expect(toUtm(21, 52, 34)[0]).toBeCloseTo(500_000, 6);
  });

  it('dlugosc luku poludnika do 52 st. N (x 0,9996) zgadza sie z wartoscia referencyjna', () => {
    // luk poludnika WGS84 od rownika do 52 st. = 5 763 343,550 m (Karney, GeographicLib)
    expect(toUtm(21, 52, 34)[1]).toBeCloseTo(5_763_343.55 * 0.9996, 0);
  });

  it('w obie strony: blad ponizej 1 cm w calej Polsce', () => {
    for (const [lng, lat] of [
      [14.2, 49.0],
      [17.86, 53.2],
      [21.59, 52.17],
      [23.9, 54.8],
    ] as const) {
      const zone = utmZone(lng);
      const [easting, northing] = toUtm(lng, lat, zone);
      const [backLng, backLat] = fromUtm(easting, northing, zone);

      expect(backLng).toBeCloseTo(lng, 7);
      expect(backLat).toBeCloseTo(lat, 7);
    }
  });

  it('odleglosci w terenie: 0,001 st. szerokosci to ok. 111 m', () => {
    const [, a] = toUtm(21.6, 52.17, 34);
    const [, b] = toUtm(21.6, 52.171, 34);

    expect(b - a).toBeGreaterThan(111);
    expect(b - a).toBeLessThan(111.4);
  });
});
