// Minimalny odczyt GeoTIFF z WCS SoilGrids i Process API Copernicus: liczby calkowite 16 bit albo float 32, jedna
// lub kilka probek na piksel (przeplot), kafle lub pasy, kompresja brak/deflate, predyktor poziomy dla 16 bit,
// georeferencja z ModelTiepoint + ModelPixelScale. Pelna biblioteka (geotiff.js) bylaby wieksza od obu adapterow,
// a oba zrodla oddaja zawsze ten sam, prosty format. Deflate rozpakowuje DecompressionStream, bez zaleznosci.

export interface Raster {
  width: number;
  height: number;
  /** wartosci pierwszej probki (warstwy) wierszami od gornego lewego rogu */
  values: Float64Array;
  /** wszystkie probki: bands[0] === values */
  bands: Float64Array[];
  /** wspolrzedne lewego gornego rogu i rozmiar piksela w jednostkach ukladu rastra (tu: stopnie WGS84) */
  originX: number;
  originY: number;
  pixelX: number;
  pixelY: number;
}

const TAG = {
  width: 256,
  height: 257,
  bitsPerSample: 258,
  compression: 259,
  samplesPerPixel: 277,
  planarConfiguration: 284,
  stripOffsets: 273,
  rowsPerStrip: 278,
  stripByteCounts: 279,
  predictor: 317,
  tileWidth: 322,
  tileLength: 323,
  tileOffsets: 324,
  tileByteCounts: 325,
  sampleFormat: 339,
  pixelScale: 33_550,
  tiepoint: 33_922,
} as const;

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

type Tags = Map<number, number[]>;

function readTags(view: DataView, little: boolean): Tags {
  const ifd = view.getUint32(4, little);
  const count = view.getUint16(ifd, little);
  const tags: Tags = new Map();

  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const n = view.getUint32(entry + 4, little);
    const size = (TYPE_SIZE[type] ?? 1) * n;
    const at = size <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
    const values: number[] = [];

    for (let i = 0; i < n; i += 1) {
      if (type === 3) values.push(view.getUint16(at + i * 2, little));
      else if (type === 4) values.push(view.getUint32(at + i * 4, little));
      else if (type === 12) values.push(view.getFloat64(at + i * 8, little));
      else if (type === 1) values.push(view.getUint8(at + i));
    }

    tags.set(tag, values);
  }

  return tags;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const first = (tags: Tags, tag: number, fallback?: number): number => {
  const value = tags.get(tag)?.[0] ?? fallback;

  if (value === undefined) throw new Error(`GeoTIFF without tag ${tag}`);

  return value;
};

/** Czyta GeoTIFF (wszystkie probki piksela). Rzuca przy formacie, ktorego zrodla nie uzywaja (np. LZW). */
export async function readGeoTiff(buffer: ArrayBuffer): Promise<Raster> {
  const view = new DataView(buffer);
  const order = view.getUint16(0, false);

  if (order !== 0x49_49 && order !== 0x4d_4d) throw new Error('not a TIFF file');

  const little = order === 0x49_49;
  const tags = readTags(view, little);
  const width = first(tags, TAG.width);
  const height = first(tags, TAG.height);
  const bits = first(tags, TAG.bitsPerSample);
  const compression = first(tags, TAG.compression, 1);
  const predictor = first(tags, TAG.predictor, 1);
  const format = first(tags, TAG.sampleFormat, 1);
  const samples = first(tags, TAG.samplesPerPixel, 1);
  const tiled = tags.has(TAG.tileOffsets);
  const blockWidth = tiled ? first(tags, TAG.tileWidth) : width;
  const blockHeight = tiled ? first(tags, TAG.tileLength) : first(tags, TAG.rowsPerStrip, height);
  const offsets = tags.get(tiled ? TAG.tileOffsets : TAG.stripOffsets) ?? [];
  const counts = tags.get(tiled ? TAG.tileByteCounts : TAG.stripByteCounts) ?? [];
  const [scaleX = 1, scaleY = 1] = tags.get(TAG.pixelScale) ?? [];
  const tiepoint = tags.get(TAG.tiepoint) ?? [0, 0, 0, 0, 0, 0];

  if (![1, 8, 32_946].includes(compression)) throw new Error(`unsupported TIFF compression ${compression}`);

  if (!(bits === 16 && format !== 3) && !(bits === 32 && format === 3)) {
    throw new Error(`unsupported TIFF sample: ${bits} bit, format ${format}`);
  }

  if (samples > 1 && first(tags, TAG.planarConfiguration, 1) !== 1) {
    throw new Error('unsupported TIFF planar configuration (separate planes)');
  }

  if (predictor === 3) throw new Error('unsupported TIFF floating point predictor');

  const bands = Array.from({ length: samples }, () => new Float64Array(width * height));
  const sampleBytes = bits / 8;
  const blocksAcross = Math.ceil(width / blockWidth);

  for (const [block, offset] of offsets.entries()) {
    const raw = new Uint8Array(buffer, offset, counts[block] ?? 0);
    const bytes = compression === 1 ? raw : await inflate(raw);
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const blockX = (block % blocksAcross) * blockWidth;
    const blockY = Math.floor(block / blocksAcross) * blockHeight;

    for (let row = 0; row < blockHeight && blockY + row < height; row += 1) {
      const previous = Array.from({ length: samples }, () => 0);

      for (let col = 0; col < blockWidth; col += 1) {
        for (let band = 0; band < samples; band += 1) {
          const at = ((row * blockWidth + col) * samples + band) * sampleBytes;

          if (at + sampleBytes > data.byteLength) break;

          let value: number;

          if (bits === 32) {
            value = data.getFloat32(at, little);
          } else {
            const raw16 = data.getUint16(at, little);

            // predyktor 2: kazda probka to roznica wzgledem tej samej probki poprzedniego piksela (modulo 2^16)
            const sample = predictor === 2 ? ((previous[band] ?? 0) + raw16) & 0xff_ff : raw16;

            previous[band] = sample;
            value = format === 2 && sample >= 0x80_00 ? sample - 0x1_00_00 : sample;
          }

          const target = bands[band];

          if (target && blockX + col < width) target[(blockY + row) * width + blockX + col] = value;
        }
      }
    }
  }

  return {
    width,
    height,
    values: bands[0] ?? new Float64Array(width * height),
    bands,
    originX: (tiepoint[3] ?? 0) - (tiepoint[0] ?? 0) * scaleX,
    originY: (tiepoint[4] ?? 0) + (tiepoint[1] ?? 0) * scaleY,
    pixelX: scaleX,
    pixelY: scaleY,
  };
}
