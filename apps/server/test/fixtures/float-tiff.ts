// GeoTIFF do testow adapterow rastrowych: jeden pas bez kompresji, float 32, kilka probek na piksel (przeplot),
// georeferencja w metrach UTM. Tak oddaje raster Process API Copernicus (NDVI, NDMI).

export interface TiffOrigin {
  originX: number;
  originY: number;
  pixel: number;
}

/** Najprostszy GeoTIFF: jeden pas bez kompresji, float 32, `samples` probek na piksel (przeplot). */
export function floatTiff(
  width: number,
  height: number,
  samples: number,
  pixels: number[],
  { originX, originY, pixel }: TiffOrigin = { originX: 600_000, originY: 5_780_000, pixel: 10 },
): ArrayBuffer {
  const entries: [number, number, number, number[]][] = [
    // [tag, typ, liczba, wartosci] - typ 3 = SHORT, 4 = LONG, 12 = DOUBLE
    [256, 3, 1, [width]],
    [257, 3, 1, [height]],
    [258, 3, 1, [32]],
    [259, 3, 1, [1]],
    [273, 4, 1, [0]],
    [277, 3, 1, [samples]],
    [278, 3, 1, [height]],
    [279, 4, 1, [pixels.length * 4]],
    [284, 3, 1, [1]],
    [339, 3, 1, [3]],
    [33_550, 12, 3, [pixel, pixel, 0]],
    [33_922, 12, 6, [0, 0, 0, originX, originY, 0]],
  ];
  const ifdSize = 2 + entries.length * 12 + 4;
  const doubles = entries.filter(([, type]) => type === 12);
  const extraSize = doubles.reduce((sum, [, , count]) => sum + count * 8, 0);
  const dataOffset = 8 + ifdSize + extraSize;
  const buffer = new ArrayBuffer(dataOffset + pixels.length * 4);
  const view = new DataView(buffer);
  let extra = 8 + ifdSize;

  view.setUint16(0, 0x49_49);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, entries.length, true);

  for (const [position, [tag, type, count, values]] of entries.entries()) {
    const at = 10 + position * 12;

    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, count, true);

    if (type === 12) {
      view.setUint32(at + 8, extra, true);

      for (const value of values) {
        view.setFloat64(extra, value, true);
        extra += 8;
      }
    } else if (tag === 273) {
      view.setUint32(at + 8, dataOffset, true);
    } else if (type === 3) {
      view.setUint16(at + 8, values[0] ?? 0, true);
    } else {
      view.setUint32(at + 8, values[0] ?? 0, true);
    }
  }

  for (const [index, value] of pixels.entries()) view.setFloat32(dataOffset + index * 4, value, true);

  return buffer;
}
