import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fieldFromGeometry } from '../../domain/field-area';
import { decodePng } from './png';
import { createTerrainTilesSource, latToPx, lngToPx, pixelWindow, type FetchLike } from './terrain-tiles';

/** Bajty RGB terrarium dla wysokosci (m): R * 256 + G + B / 256 - 32768. */
function terrariumRgb(heightM: number): number[] {
  const value = heightM + 32_768;

  return [Math.floor(value / 256), Math.floor(value) % 256, Math.round((value % 1) * 256) % 256];
}

/** PNG RGB 256 x 256 w formacie terrarium z funkcji wysokosci (globalne piksele), filtr Sub w co drugim wierszu. */
async function terrariumPng(height: (px: number, py: number) => number, x0: number, y0: number) {
  const size = 256;
  const stride = size * 3;
  const raw = new Uint8Array(size * (stride + 1));

  for (let row = 0; row < size; row += 1) {
    const bytes = Array.from({ length: size }, (_unused, col) =>
      terrariumRgb(height(x0 + col, y0 + row)),
    ).flat();
    const filter = row % 2;

    raw[row * (stride + 1)] = filter;
    bytes.forEach((value, index) => {
      // filtr Sub: roznica z tym samym kanalem lewego sasiada
      const left = filter === 1 && index >= 3 ? (bytes[index - 3] ?? 0) : 0;

      raw[row * (stride + 1) + 1 + index] = (value - left + 256) & 0xff;
    });
  }

  const compressed = new Uint8Array(
    await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer(),
  );
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);

    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);

    return out;
  };
  const header = new Uint8Array(13);

  new DataView(header.buffer).setUint32(0, size);
  new DataView(header.buffer).setUint32(4, size);
  header.set([8, 2, 0, 0, 0], 8);

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', compressed),
    chunk('IEND', new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));

  parts.reduce((at, part) => {
    png.set(part, at);

    return at + part.length;
  }, 0);

  return png.buffer;
}

const field: FieldArea = fieldFromGeometry({
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [21.56, 52.17],
        [21.5636, 52.17],
        [21.5636, 52.1718],
        [21.56, 52.1718],
        [21.56, 52.17],
      ],
    ],
  },
  kind: 'drawn',
  parcelIds: [],
});

describe('decodePng', () => {
  it('czyta RGB z filtrami Sub i None', async () => {
    const image = await decodePng(await terrariumPng((px) => 100 + px * 0.5, 0, 0));

    expect([image.width, image.height, image.channels]).toEqual([256, 256, 3]);
    // piksel (3, 1): 100 + 1,5 m -> 32869,5 = R 128, G 101, B 128
    expect([...image.pixels.subarray((256 + 3) * 3, (256 + 3) * 3 + 3)]).toEqual([128, 101, 128]);
  });

  it('odrzuca plik, ktory nie jest PNG', async () => {
    await expect(decodePng(new ArrayBuffer(16))).rejects.toThrow(/PNG/);
  });
});

describe('createTerrainTilesSource', () => {
  it('pochylnia z kafli terrarium: spadek pola, brak zaglebien, model 30 m nazwany w zrodle', async () => {
    const window = pixelWindow(field.bbox);
    // spadek 4% na poludnie w metrach terenu: wysokosc maleje z globalnym wierszem piksela
    const metersPerPx = (40_075_016.686 * Math.cos((52.171 * Math.PI) / 180)) / (256 * 2 ** window.zoom);
    const fetch: FetchLike = async (url) => {
      const [, x = '0', y = '0'] = /\/(\d+)\/(\d+)\.png$/.exec(url) ?? [];

      return new Response(
        await terrariumPng(
          (_px, py) => 200 - 0.04 * metersPerPx * (py - latToPx(52.17, window.zoom)),
          Number(x) * 256,
          Number(y) * 256,
        ),
      );
    };
    const result = await createTerrainTilesSource({ fetch, now: () => '2026-11-21T12:00:00Z' }).terrain(
      field,
    );

    expect(result.source).toMatchObject({ id: 'terrain', status: 'ok', sample: false });
    expect(result.source.resolution).toContain('30 m');
    expect(result.data?.summary.slopeMeanPct).toBeCloseTo(4, 0);
    expect(result.data?.summary).toMatchObject({ slopeShareAbove5Pct: 0, depressions: 0 });
    expect(result.data?.grid.cols).toBeGreaterThan(
      Math.round(lngToPx(21.5636, window.zoom) - lngToPx(21.56, window.zoom)),
    );
  });

  it('blad kafla to `missing` z polskim powodem', async () => {
    const result = await createTerrainTilesSource({
      fetch: () => Promise.resolve(new Response('', { status: 503 })),
    }).terrain(field);

    expect(result).toMatchObject({
      data: null,
      source: { status: 'missing', note: 'Terrain Tiles: awaria usługi (HTTP 503)' },
    });
  });
});
