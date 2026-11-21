import type { FieldArea } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import { fieldFromGeometry } from '../../domain/field-area';
import { readGeoTiff } from '../geotiff';
import { coverageUrl, createSoilGridsSource, substitutePixels, type FetchLike } from './soilgrids';
import recorded from './soilgrids-minsk.recorded.json?raw';

// Nagranie: WCS SoilGrids (srednie, 18 pokryc: piasek, il, wegiel x 6 warstw) dla prostokata 21,559-21,5646 E,
// 52,169-52,1725 N, pobrane 21.11.2026; GeoTIFF int16, kafle 256 x 256, deflate z predyktorem poziomym.
const TIFFS = JSON.parse(recorded) as Record<string, string>;

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

const bytes = (base64: string): ArrayBuffer =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;

const replay: FetchLike = (url) => {
  const [, property, depth] = /COVERAGEID=(\w+)_([\w-]+)_mean/.exec(url) ?? [];
  const tiff = TIFFS[`${property}_${depth}`];

  return Promise.resolve(tiff ? new Response(bytes(tiff)) : new Response('not found', { status: 404 }));
};

/** Nieskompresowany GeoTIFF 1 x 1 int16 z jedna wartoscia (jak piksel bez predykcji SoilGrids). */
function tinyTiff(value: number): ArrayBuffer {
  const entries: [number, number, number, number][] = [
    [256, 3, 1, 1],
    [257, 3, 1, 1],
    [258, 3, 1, 16],
    [259, 3, 1, 1],
    [273, 4, 1, 8 + 2 + 7 * 12 + 4],
    [279, 4, 1, 2],
    [339, 3, 1, 2],
  ];
  const buffer = new ArrayBuffer(8 + 2 + entries.length * 12 + 4 + 2);
  const view = new DataView(buffer);

  view.setUint16(0, 0x49_49, false);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, entries.length, true);
  entries.forEach(([tag, type, count, data], index) => {
    const at = 10 + index * 12;

    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, count, true);

    if (type === 3) view.setUint16(at + 8, data, true);
    else view.setUint32(at + 8, data, true);
  });
  view.setInt16(buffer.byteLength - 2, value, true);

  return buffer;
}

describe('readGeoTiff', () => {
  it('czyta kafel deflate z predyktorem i georeferencje (lewy gorny rog, piksel 0,0028 stopnia)', async () => {
    const raster = await readGeoTiff(bytes(TIFFS['sand_0-5cm'] ?? ''));

    expect(raster.originX).toBeCloseTo(21.559, 6);
    expect(raster.originY).toBeCloseTo(52.1725, 6);
    expect(raster.pixelX).toBeCloseTo(0.0028, 6);
    // dwa piksele ok. 250 m: 75,5% piasku i 0 = brak predykcji (SoilGrids maskuje zabudowe)
    expect([raster.width, raster.height, ...raster.values]).toEqual([2, 1, 755, 0]);
  });

  it('czyta nieskompresowany pas i ujemne int16; odrzuca plik, ktory nie jest TIFF-em', async () => {
    expect([...(await readGeoTiff(tinyTiff(-7))).values]).toEqual([-7]);
    await expect(readGeoTiff(new ArrayBuffer(16))).rejects.toThrow(/TIFF/);
  });
});

describe('createSoilGridsSource', () => {
  it('pole koło Minska: profil z 6 warstw, zakres kategorii z uziarnienia i wody, do progu lzejszy koniec', async () => {
    const result = await createSoilGridsSource({ fetch: replay, now: () => '2026-11-21T12:00:00Z' }).profile(
      field,
    );

    expect(result.data).toMatchObject({
      sandPct: 73,
      siltPct: 15.9,
      clayPct: 11.1,
      availableWaterMmPerM: 85.2,
      availableWaterProfileMm: 123.3,
      textureClass: 'gp',
      category: 1,
      categoryRange: [1, 3],
      basis: 'texture',
      modelled: true,
    });
    expect(result.source).toMatchObject({
      id: 'soil',
      status: 'ok',
      sample: false,
      resolution: '250 m (model globalny)',
    });
    expect(result.source.provider).toContain('nie mapa glebowo-rolnicza');
    expect(result.source.note).toContain('nie mapa glebowa');
  });

  it('brak predykcji (zabudowa, woda), blad HTTP i zly plik to `missing` z powodem', async () => {
    const zeros = await createSoilGridsSource({
      fetch: () => Promise.resolve(new Response(tinyTiff(0))),
    }).profile(field);
    const failing = await createSoilGridsSource({
      fetch: () => Promise.resolve(new Response('busy', { status: 503 })),
    }).profile(field);
    const broken = await createSoilGridsSource({
      fetch: () => Promise.resolve(new Response('<ExceptionReport/>')),
    }).profile(field);

    expect([zeros, failing, broken].map((result) => [result.data, result.source.status])).toEqual([
      [null, 'missing'],
      [null, 'missing'],
      [null, 'missing'],
    ]);
    expect(zeros.source.note).toContain('zabudowa');
    expect(zeros.source.note).toContain('2 km');
    expect(failing.source.note).toContain('503');
  });

  it('pole bez predykcji: gleba zastepcza z najblizszych pikseli w drugim odczycie z marginesem 2 km', async () => {
    // pole ok. 450 m na wschod od piksela z predykcja (75,5% piasku); w pierwszym odczycie same zera (zabudowa)
    const builtUp = fieldFromGeometry({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [21.567, 52.17],
            [21.568, 52.17],
            [21.568, 52.1708],
            [21.567, 52.1708],
            [21.567, 52.17],
          ],
        ],
      },
      kind: 'drawn',
      parcelIds: [],
    });
    const wide = (url: string): boolean => {
      const [, west = '0', east = '0'] = /SUBSET=long\(([\d.]+),([\d.]+)\)/.exec(url) ?? [];

      return Number(east) - Number(west) > 0.01;
    };
    const fetch: FetchLike = (url, init) =>
      wide(url) ? replay(url, init) : Promise.resolve(new Response(tinyTiff(0)));
    const result = await createSoilGridsSource({ fetch }).profile(builtUp);

    expect(result.data).toMatchObject({ textureClass: 'gp', substituteDistanceM: 450, modelled: true });
    expect(result.source.status).toBe('partial');
    expect(result.source.note).toContain('ok. 450 m od pola');
  });

  it('pierscienie gleby zastepczej: najmniejszy z pikselem z predykcja wygrywa', () => {
    const raster = (values: number[]) => ({
      width: values.length,
      height: 1,
      values: Float64Array.from(values),
      bands: [Float64Array.from(values)],
      originX: 21.56,
      originY: 52.171,
      pixelX: 0.01,
      pixelY: 0.002,
    });
    // pole w pierwszym pikselu (bez predykcji); drugi piksel ok. 690 m, trzeci ok. 1370 m od pola
    const near = substitutePixels({ sand: raster([0, 500, 600]), clay: raster([0, 100, 100]) }, field);
    const far = substitutePixels({ sand: raster([0, 0, 0, 0, 600]), clay: raster([0, 0, 0, 0, 0]) }, field);

    expect(near?.pixels).toEqual([1]);
    expect(near?.distanceM).toBeGreaterThan(500);
    expect(near?.distanceM).toBeLessThan(1000);
    expect(far).toBeNull();
  });

  it('adres WCS: wlasciwosc, warstwa, prostokat pola z marginesem w WGS84', () => {
    expect(coverageUrl('clay', '30-60cm', field.bbox)).toContain(
      'map=/map/clay.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=clay_30-60cm_mean',
    );
    expect(coverageUrl('clay', '30-60cm', field.bbox)).toContain('SUBSET=long(21.55850,21.56510)');
  });
});
