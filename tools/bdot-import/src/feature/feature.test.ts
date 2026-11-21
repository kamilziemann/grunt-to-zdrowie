import { describe, expect, it } from 'vitest';

import { HYDRO_KIND, HYDRO_LAYERS, type HydroLayer } from '../layers';
import { simplifyGeometry, toHydroRecord } from './feature';

function layer(id: HydroLayer['id']): HydroLayer {
  const found = HYDRO_LAYERS.find((candidate) => candidate.id === id);

  if (!found) throw new Error(`brak warstwy ${id}`);

  return found;
}

const LINE = {
  type: 'LineString',
  coordinates: [
    [637_000, 487_000],
    [637_050, 487_000.4],
    [637_100, 487_000],
  ],
};

describe('toHydroRecord', () => {
  it('row na powierzchni: rodzaj, brak nazwy, uproszczona linia w EWKB', () => {
    const record = toHydroRecord(layer('ditches'), { POLOZENIE: 'na powierzchni', GEOM: LINE }, 2);

    expect(record).toMatchObject({ k: HYDRO_KIND.ditch, n: null });
    // naglowek linii z SRID + 2 punkty (srodkowy odpadl)
    expect(record?.g.startsWith('01020000208408000002000000')).toBe(true);
  });

  it('pomija odcinki pod powierzchnia i wody morskie', () => {
    expect(toHydroRecord(layer('ditches'), { POLOZENIE: 'pod powierzchnią', GEOM: LINE }, 2)).toBeNull();
    expect(toHydroRecord(layer('waters'), { RODZAJ: 'woda morska', GEOM: LINE }, 2)).toBeNull();
  });

  it('rozroznia rzeke od strumienia i przenosi nazwe', () => {
    const river = toHydroRecord(layer('watercourses'), { RODZAJ: 'rzeka', NAZWA: ' Mienia ', GEOM: LINE }, 2);
    const stream = toHydroRecord(
      layer('watercourses'),
      { RODZAJ: 'strumień, potok lub struga', NAZWA: null, GEOM: LINE },
      2,
    );

    expect(river).toMatchObject({ k: HYDRO_KIND.river, n: 'Mienia' });
    expect(stream).toMatchObject({ k: HYDRO_KIND.stream, n: null });
  });

  it('bagno i teren podmokly to osobne rodzaje', () => {
    const ring = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    const geometry = { type: 'Polygon', coordinates: [ring] };

    expect(toHydroRecord(layer('wetlands'), { RODZAJ: 'bagno', GEOM: geometry }, 2)?.k).toBe(HYDRO_KIND.bog);
    expect(toHydroRecord(layer('wetlands'), { RODZAJ: 'teren podmokły', GEOM: geometry }, 2)?.k).toBe(
      HYDRO_KIND.wetland,
    );
  });
});

describe('simplifyGeometry', () => {
  it('odrzuca wartosci, ktore nie sa obslugiwana geometria', () => {
    expect(simplifyGeometry(null, 2)).toBeNull();
    expect(simplifyGeometry({ type: 'Point', coordinates: [1, 2] }, 2)).toBeNull();
    expect(simplifyGeometry({ type: 'LineString', coordinates: [[1, 2]] }, 2)).toBeNull();
    expect(simplifyGeometry({ type: 'LineString', coordinates: 'x' }, 2)).toBeNull();
  });
});
