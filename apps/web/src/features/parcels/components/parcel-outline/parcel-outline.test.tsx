import type { ParcelGeometry } from '@app/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { outlinePath, ParcelOutline } from './parcel-outline';

const SQUARE: ParcelGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [20, 52],
      [20.001, 52],
      [20.001, 52.001],
      [20, 52.001],
      [20, 52],
    ],
  ],
};

const ONE = [SQUARE];
const NONE: ParcelGeometry[] = [];

function points(path: string): number[][] {
  return [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x = '', y = '']) => [Number(x), Number(y)]);
}

describe('outlinePath', () => {
  it('mieści obrys w polu 100 x 100 z marginesem, północ u góry', () => {
    const path = outlinePath([SQUARE]);
    const coords = points(path);

    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);

    for (const [x = 0, y = 0] of coords) {
      expect(x).toBeGreaterThanOrEqual(12);
      expect(x).toBeLessThanOrEqual(88);
      expect(y).toBeGreaterThanOrEqual(12);
      expect(y).toBeLessThanOrEqual(88);
    }

    // pierwszy punkt to poludniowo-zachodni naroznik: lewy dol
    expect(coords[0]?.[1]).toBeCloseTo(88);
  });

  it('skraca długość geograficzną o cos(szerokości): kwadrat w stopniach jest węższy niż wyższy', () => {
    const coords = points(outlinePath([SQUARE]));
    const xs = coords.map(([x = 0]) => x);
    const ys = coords.map(([, y = 0]) => y);

    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(76 * Math.cos((52.0005 * Math.PI) / 180), 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(76);
  });

  it('łączy kilka działek i zwraca pusty napis bez geometrii', () => {
    const moved: ParcelGeometry = {
      type: 'MultiPolygon',
      coordinates: [SQUARE.coordinates.map((ring) => ring.map(([lng, lat]) => [lng + 0.002, lat]))],
    };

    expect(outlinePath([SQUARE, moved]).match(/M/g)).toHaveLength(2);
    expect(outlinePath([])).toBe('');
  });
});

describe('ParcelOutline', () => {
  it('rysuje obrys jako ozdobny SVG', () => {
    render(<ParcelOutline geometries={ONE} />);

    expect(screen.getByTestId('parcel-outline')).toHaveAttribute('aria-hidden', 'true');
  });

  it('nic nie rysuje bez geometrii', () => {
    const { container } = render(<ParcelOutline geometries={NONE} />);

    expect(container).toBeEmptyDOMElement();
  });
});
