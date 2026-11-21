import { describe, expect, it } from 'vitest';

import { floatTiff } from '../../../test/fixtures/float-tiff';
import { readGeoTiff } from './geotiff';

describe('readGeoTiff', () => {
  it('dwie probki float 32 na piksel (NDVI, NDMI z Process API) z NaN i georeferencja', async () => {
    // 2 x 2 piksele, w kazdym [ndvi, ndmi]
    const raster = await readGeoTiff(
      floatTiff(2, 2, 2, [0.5, 0.25, 0.75, 0.125, Number.NaN, Number.NaN, 0.5, 0.5]),
    );

    expect(raster).toMatchObject({ width: 2, height: 2, originX: 600_000, originY: 5_780_000, pixelX: 10 });
    expect([...(raster.bands[0] ?? [])]).toEqual([0.5, 0.75, Number.NaN, 0.5]);
    expect([...(raster.bands[1] ?? [])]).toEqual([0.25, 0.125, Number.NaN, 0.5]);
    expect(raster.values).toBe(raster.bands[0]);
  });

  it('plik, ktory nie jest TIFF-em, to blad', async () => {
    await expect(readGeoTiff(new ArrayBuffer(16))).rejects.toThrow('not a TIFF');
  });
});
