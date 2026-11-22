import { describe, expect, it } from 'vitest';

import { hydroContextFromRows } from './hydro-context';

describe('hydroContextFromRows', () => {
  it('laczy kody BDOT w rodzaje: kanal i szerokie koryto to ciek, bagno to mokradlo', () => {
    const context = hydroContextFromRows(
      [
        { kind: 1, features: 3, nearestM: 120.4, nearestName: null, lengthInFieldM: 0 },
        { kind: 4, features: 1, nearestM: 80.2, nearestName: 'Kanał Wieprz-Krzna', lengthInFieldM: 0 },
        { kind: 6, features: 1, nearestM: 300, nearestName: 'Wisła', lengthInFieldM: 0 },
        { kind: 8, features: 2, nearestM: 410, nearestName: null, lengthInFieldM: 0 },
      ],
      [],
      500,
    );

    expect(context).toMatchObject({
      nearestDitchM: 120,
      nearestWatercourseM: 80,
      nearestWatercourseName: 'Kanał Wieprz-Krzna',
      nearestWetlandM: 410,
      wetlands: 2,
      nearestWaterBodyM: null,
      waterBodies: 0,
      ditchesInRadius: 3,
    });
  });

  it('pusty wynik to "nic w promieniu" (null), a nie brak danych', () => {
    expect(hydroContextFromRows([], [], 500)).toEqual({
      searchRadiusM: 500,
      nearestWatercourseM: null,
      nearestDitchM: null,
      nearestWaterBodyM: null,
      nearestWetlandM: null,
      waterBodies: 0,
      wetlands: 0,
      ditchesInRadius: 0,
      ditchLengthInFieldM: 0,
      nearestWatercourseName: null,
      waterAreaShare: 0,
      features: [],
      treeCoverShare: null,
    });
  });

  it('woda w granicach pola: jezioro i szerokie koryto sumuja sie (najwyzej 1), mokradlo i row nie', () => {
    const row = (kind: number, areaShareInField: number) => ({
      kind,
      features: 1,
      nearestM: 0,
      nearestName: null,
      lengthInFieldM: 0,
      areaShareInField,
    });

    expect(hydroContextFromRows([row(5, 0.87)], [], 500).waterAreaShare).toBe(0.87);
    expect(hydroContextFromRows([row(5, 0.2), row(6, 0.15), row(7, 0.4)], [], 500).waterAreaShare).toBe(0.35);
    expect(hydroContextFromRows([row(5, 0.7), row(6, 0.6)], [], 500).waterAreaShare).toBe(1);
  });

  it('rozbija geometrie Multi* na linie, z poligonow bierze obrys, pomija nieznane kody', () => {
    const { features } = hydroContextFromRows(
      [],
      [
        {
          kind: 1,
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [19, 54],
                [19.001, 54],
              ],
              [
                [19.002, 54],
                [19.003, 54.001],
              ],
            ],
          },
        },
        {
          kind: 5,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [19, 54],
                [19.001, 54],
                [19.001, 54.001],
                [19, 54],
              ],
            ],
          },
        },
        { kind: 99, geometry: { type: 'LineString', coordinates: [[19, 54]] } },
      ],
      500,
    );

    expect(features.map((feature) => [feature.kind, feature.coordinates.length])).toEqual([
      ['ditch', 2],
      ['ditch', 2],
      ['water_body', 4],
    ]);
  });
});
