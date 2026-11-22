import type { HydroFeature, ParcelGeometry } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildFieldSketch,
  clipToField,
  closestPair,
  labelPoint,
  localProjection,
  niceScale,
  SKETCH_WIDTH,
  sketchGroup,
} from './field-sketch';

// kwadrat ok. 68 x 67 m kolo Minska Mazowieckiego (0,001 stopnia dlugosci, 0,0006 szerokosci)
const FIELD: ParcelGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [21.59, 52.172],
      [21.591, 52.172],
      [21.591, 52.1726],
      [21.59, 52.1726],
      [21.59, 52.172],
    ],
  ],
};
const CENTER = [21.5905, 52.1723];

function ditch(coordinates: [number, number][], kind: HydroFeature['kind'] = 'ditch'): HydroFeature {
  return { kind, name: kind === 'river' ? 'Srebrna' : null, geometry: { type: 'LineString', coordinates } };
}

describe('rzut lokalny', () => {
  it('daje metry na wschod i polnoc od srodka', () => {
    const project = localProjection(CENTER);
    const [x, y] = project([21.591, 52.1726]);

    expect(project(CENTER)).toEqual([0, 0]);
    // 0,0005 stopnia dlugosci na 52,17 N to ok. 34 m, 0,0003 szerokosci ok. 33 m
    expect(x).toBeCloseTo(34.1, 0);
    expect(y).toBeCloseTo(33.2, 0);
  });
});

describe('odcinki w polu i najblizsze punkty', () => {
  const square: [number, number][][] = [
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
  ];

  it('tnie linie na granicy pola', () => {
    const pieces = clipToField(
      [
        [-50, 50],
        [150, 50],
      ],
      square,
    );

    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.[0]?.[0]).toBeCloseTo(0);
    expect(pieces[0]?.at(-1)?.[0]).toBeCloseTo(100);
  });

  it('linia poza polem nie ma odcinkow w polu', () => {
    expect(
      clipToField(
        [
          [120, 0],
          [120, 100],
        ],
        square,
      ),
    ).toEqual([]);
  });

  it('linia wymiarowa laczy granice pola z najblizszym punktem obiektu', () => {
    const pair = closestPair(square, [
      [
        [130, -40],
        [130, 140],
      ],
    ]);

    expect(pair.distance).toBeCloseTo(30);
    expect(pair.from[0]).toBeCloseTo(100);
    expect(pair.to[0]).toBeCloseTo(130);
  });

  it('podzialka to ladna liczba okolo 1/4 szerokosci', () => {
    expect(niceScale(570)).toBe(100);
    expect(niceScale(900)).toBe(200);
    expect(niceScale(2400)).toBe(500);
  });

  it('grupuje rodzaje BDOT10k jak legenda', () => {
    expect(sketchGroup('ditch')).toBe('ditch');
    expect(sketchGroup('river')).toBe('watercourse');
    expect(sketchGroup('stream')).toBe('watercourse');
    expect(sketchGroup('canal')).toBe('canal');
    expect(sketchGroup('standing_water')).toBe('water');
    expect(sketchGroup('flowing_water')).toBe('water');
    expect(sketchGroup('bog')).toBe('wetland');
  });
});

describe('model szkicu', () => {
  it('row przez pole: dlugosc w polu i wyroznienie', () => {
    const sketch = buildFieldSketch(FIELD, CENTER, [
      ditch([
        [21.5895, 52.1723],
        [21.5915, 52.1723],
      ]),
    ]);

    expect(sketch.fact).toMatchObject({ kind: 'ditch_through', lengthM: 68, alongEdge: false });
    expect(sketch.highlight).toMatch(/^M/);
    expect(sketch.groups).toEqual(['ditch']);
    expect(sketch.width).toBe(SKETCH_WIDTH);
  });

  it('row tuz przy granicy, w polu: row na skraju pola', () => {
    const sketch = buildFieldSketch(FIELD, CENTER, [
      // ok. 3 m od poludniowej granicy, wewnatrz pola
      ditch([
        [21.5895, 52.17203],
        [21.5915, 52.17203],
      ]),
    ]);

    expect(sketch.fact).toMatchObject({ kind: 'ditch_through', alongEdge: true });
  });

  it('dlugosc z raportu ma pierwszenstwo przed policzona', () => {
    const sketch = buildFieldSketch(
      FIELD,
      CENTER,
      [
        ditch([
          [21.5895, 52.1723],
          [21.5915, 52.1723],
        ]),
      ],
      { ditchInFieldM: 71.4 },
    );

    expect(sketch.fact).toMatchObject({ kind: 'ditch_through', lengthM: 71 });
  });

  it('row obok pola: odleglosc i linia wymiarowa; obiekty dalej niz 250 m pominiete', () => {
    const sketch = buildFieldSketch(FIELD, CENTER, [
      // ok. 136 m na wschod
      ditch([
        [21.593, 52.1715],
        [21.593, 52.173],
      ]),
      // ok. 680 m na wschod - poza szkicem
      ditch(
        [
          [21.601, 52.1715],
          [21.601, 52.173],
        ],
        'river',
      ),
    ]);

    expect(sketch.fact).toMatchObject({ kind: 'nearest_ditch' });
    expect(sketch.fact?.kind === 'nearest_ditch' && sketch.fact.distanceM).toBeCloseTo(137, -1);
    expect(sketch.lines).toHaveLength(1);
    expect(sketch.names).toEqual([]);
  });

  it('bez rowow: najblizszy ciek z nazwa i podpis przy linii', () => {
    const sketch = buildFieldSketch(FIELD, CENTER, [
      ditch(
        [
          [21.5925, 52.1715],
          [21.5925, 52.173],
        ],
        'river',
      ),
    ]);

    expect(sketch.fact).toMatchObject({ kind: 'nearest_watercourse', name: 'Srebrna', featureKind: 'river' });
    expect(sketch.names.map((label) => label.text)).toEqual(['Srebrna']);
  });

  it('bez hydrografii: sam obrys pola, bez faktu, polnoc u gory', () => {
    const sketch = buildFieldSketch(FIELD, CENTER, []);
    const [, northY] = sketch.fieldCenter;

    expect(sketch.fact).toBeNull();
    expect(sketch.field).toMatch(/Z$/);
    expect(sketch.lines).toEqual([]);
    // pole + 250 m z kazdej strony: ok. 570 m szerokosci, podzialka 100 m
    expect(sketch.scale.meters).toBe(100);
    expect(northY).toBeCloseTo(sketch.height / 2, 0);
  });

  it('obiekt z dwoch kafli wchodzi raz', () => {
    const feature = ditch([
      [21.5895, 52.1723],
      [21.5915, 52.1723],
    ]);
    const sketch = buildFieldSketch(FIELD, CENTER, [feature, { ...feature }]);

    expect(sketch.lines).toHaveLength(1);
    expect(sketch.fact).toMatchObject({ lengthM: 68 });
  });
});

describe('miejsca na polu', () => {
  it('numer litery C stoi w jej grzbiecie, nie w pustym srodku', () => {
    // C: kwadrat 0..90 bez wciecia 30..90 x 30..60
    const shape: [number, number][][][] = [
      [
        [
          [0, 0],
          [90, 0],
          [90, 30],
          [30, 30],
          [30, 60],
          [90, 60],
          [90, 90],
          [0, 90],
          [0, 0],
        ],
      ],
    ];
    const [x, y] = labelPoint(shape);

    expect(x < 30 || y < 30 || y > 60).toBe(true);
  });

  it('rzutuje strefy tym samym rzutem co pole, linie splywu jako linie', () => {
    const model = buildFieldSketch(FIELD, CENTER, [], {
      zones: [
        { id: 'zone-1', geometry: FIELD },
        {
          id: 'zone-2',
          geometry: {
            type: 'LineString',
            coordinates: [
              [21.59, 52.1723],
              [21.591, 52.1723],
            ],
          },
        },
      ],
    });

    expect(model.zones.map((zone) => [zone.id, zone.line])).toEqual([
      ['zone-1', false],
      ['zone-2', true],
    ]);
    expect(model.zones[0]?.d).toBe(model.field);
    // numer pola - w jego srodku
    expect(model.zones[0]?.labelAt[0]).toBeCloseTo(model.fieldCenter[0], -1);
    expect(model.zones[0]?.labelAt[1]).toBeCloseTo(model.fieldCenter[1], -1);
  });
});
