import type { Parcel } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fieldFromGeometry, formatHectares, fieldFromParcels, shortHash } from './field-area';

function parcel(id: string, number: string, west: number): Parcel {
  return {
    id,
    number,
    region: 'Dąbrowa',
    commune: 'Krośnice',
    county: 'powiat milicki',
    voivodeship: 'dolnośląskie',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, 52],
          [west + 0.001456, 52],
          [west + 0.001456, 52.000899],
          [west, 52.000899],
          [west, 52],
        ],
      ],
    },
    bbox: [west, 52, west + 0.001456, 52.000899],
    centroid: [west + 0.000728, 52.00045],
    areaHa: 1,
    source: 'uldk',
    fetchedAt: '2026-11-21T12:00:00.000Z',
  };
}

describe('pole analizy', () => {
  it('jedna dzialka to pole typu parcel z jej geometria', () => {
    const field = fieldFromParcels([parcel('020101_2.0001.12', '12', 21)]);

    expect(field).toMatchObject({ kind: 'parcel', parcelIds: ['020101_2.0001.12'], label: '12 · Dąbrowa' });
    expect(field.geometry.type).toBe('Polygon');
    expect(field.areaHa).toBeCloseTo(1, 1);
    expect(field.centroid[0]).toBeCloseTo(21.000728, 5);
  });

  it('kilka dzialek to jedno pole wieloczesciowe z suma powierzchni i wspolnym zasiegiem', () => {
    const field = fieldFromParcels([
      parcel('020101_2.0001.12', '12', 21),
      parcel('020101_2.0001.13', '13', 21.01),
    ]);

    expect(field.kind).toBe('parcels');
    expect(field.geometry.type).toBe('MultiPolygon');
    expect(field.areaHa).toBeCloseTo(2, 1);
    expect(field.bbox[0]).toBe(21);
    expect(field.bbox[2]).toBeCloseTo(21.011456, 6);
    expect(field.label).toBe('12, 13 · Dąbrowa');
  });

  it('identyfikator nie zalezy od kolejnosci dzialek, a zalezy od ich zestawu', () => {
    const a = parcel('020101_2.0001.12', '12', 21);
    const b = parcel('020101_2.0001.13', '13', 21.01);

    expect(fieldFromParcels([a, b]).id).toBe(fieldFromParcels([b, a]).id);
    expect(fieldFromParcels([a]).id).not.toBe(fieldFromParcels([a, b]).id);
  });

  it('obszar narysowany dostaje identyfikator ze skrotu geometrii', () => {
    const { geometry } = parcel('x', '1', 21);
    const field = fieldFromGeometry({ geometry, kind: 'drawn', parcelIds: [] });

    expect(field).toMatchObject({ kind: 'drawn', parcelIds: [] });
    expect(field.label).toMatch(/^Własny obszar, \d+,\d+ ha$/);
    expect(field.id).toMatch(/^area:[0-9a-f]{8}$/);
    expect(shortHash('abc')).toBe(shortHash('abc'));
    expect(shortHash('abc')).not.toBe(shortHash('abd'));
  });

  it('fragment dzialki bez opisu dostaje numer dzialki i powierzchnie po polsku', () => {
    const { geometry } = parcel('x', '1', 21);
    const part = fieldFromGeometry({ geometry, kind: 'part', parcelIds: ['141201_1.0001.6509'] });
    const named = fieldFromGeometry({ geometry, kind: 'part', label: 'Za stodołą', parcelIds: [] });

    expect(part.label).toMatch(/^Część działki 6509, \d+,\d+ ha$/);
    expect(named.label).toBe('Za stodołą');
    expect([formatHectares(0.274), formatHectares(1.24)]).toEqual(['0,27 ha', '1,2 ha']);
  });
});
