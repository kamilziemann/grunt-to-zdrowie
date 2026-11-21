// Minimalny dekoder PNG dla kafli wysokosci (8 bitow, RGB albo RGBA, bez przeplotu): IDAT -> inflate
// (`DecompressionStream`, format zlib) -> odwrocenie filtrow wierszy. Nic wiecej kafle terrarium nie uzywaja.
export interface RgbImage {
  width: number;
  height: number;
  /** bajty pikseli wierszami, `channels` na piksel */
  pixels: Uint8Array;
  channels: 3 | 4;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);

  if (toLeft <= toUp && toLeft <= toUpLeft) return left;

  return toUp <= toUpLeft ? up : upLeft;
}

/** Odwraca filtry PNG (0 brak, 1 Sub, 2 Up, 3 Average, 4 Paeth) wiersz po wierszu. */
function unfilter(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)] ?? 0;
    const source = row * (stride + 1) + 1;
    const target = row * stride;

    for (let index = 0; index < stride; index += 1) {
      const value = raw[source + index] ?? 0;
      const left = index >= channels ? (out[target + index - channels] ?? 0) : 0;
      const up = row > 0 ? (out[target - stride + index] ?? 0) : 0;
      const upLeft = row > 0 && index >= channels ? (out[target - stride + index - channels] ?? 0) : 0;
      const predicted =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0;

      out[target + index] = (value + predicted) & 0xff;
    }
  }

  return out;
}

export async function decodePng(buffer: ArrayBuffer): Promise<RgbImage> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (!SIGNATURE.every((value, index) => bytes[index] === value)) throw new Error('not a PNG file');

  let offset = 8;
  let width = 0;
  let height = 0;
  let channels: 3 | 4 = 3;
  const chunks: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCodePoint(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);

      const [depth, color, , , interlace] = data.subarray(8, 13);

      if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0) {
        throw new Error(`unsupported PNG (bit depth ${depth}, colour type ${color}, interlace ${interlace})`);
      }

      channels = color === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      chunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));

  chunks.reduce((at, chunk) => {
    joined.set(chunk, at);

    return at + chunk.length;
  }, 0);

  return { width, height, channels, pixels: unfilter(await inflate(joined), width, height, channels) };
}
