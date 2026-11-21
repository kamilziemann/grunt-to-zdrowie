// Zapis geometrii jako EWKB (format PostGIS: WKB + numer ukladu wspolrzednych) w postaci szesnastkowej. Po co:
// Postgres zamienia taki napis na `geometry` jednym rzutowaniem, wiec import nie potrzebuje GDAL ani funkcji
// posrednich po stronie bazy. Obslugiwane typy to te, ktore wystepuja w importowanych klasach BDOT10k.
import type { Position } from '../simplify';

export type LineGeometry =
  | { type: 'LineString'; coordinates: readonly Position[] }
  | { type: 'MultiLineString'; coordinates: readonly (readonly Position[])[] };

export type AreaGeometry =
  | { type: 'Polygon'; coordinates: readonly (readonly Position[])[] }
  | { type: 'MultiPolygon'; coordinates: readonly (readonly (readonly Position[])[])[] };

export interface PointGeometry {
  type: 'Point';
  coordinates: Position;
}

export type HydroGeometry = PointGeometry | LineGeometry | AreaGeometry;

const WKB_TYPE = { Point: 1, LineString: 2, Polygon: 3, MultiLineString: 5, MultiPolygon: 6 } as const;
const SRID_FLAG = 0x20_00_00_00;
const LITTLE_ENDIAN = 1;

class Writer {
  private buffer = new ArrayBuffer(1024);
  private view = new DataView(this.buffer);
  private offset = 0;

  private reserve(bytes: number): void {
    if (this.offset + bytes <= this.buffer.byteLength) return;

    const next = new ArrayBuffer(Math.max(this.buffer.byteLength * 2, this.offset + bytes));

    new Uint8Array(next).set(new Uint8Array(this.buffer, 0, this.offset));
    this.buffer = next;
    this.view = new DataView(next);
  }

  byte(value: number): void {
    this.reserve(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  uint32(value: number): void {
    this.reserve(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  point([x, y]: Position): void {
    this.reserve(16);
    this.view.setFloat64(this.offset, x, true);
    this.view.setFloat64(this.offset + 8, y, true);
    this.offset += 16;
  }

  points(points: readonly Position[]): void {
    this.uint32(points.length);
    this.reserve(points.length * 16);

    for (const [x, y] of points) {
      this.view.setFloat64(this.offset, x, true);
      this.view.setFloat64(this.offset + 8, y, true);
      this.offset += 16;
    }
  }

  hex(): string {
    return Buffer.from(this.buffer, 0, this.offset).toString('hex');
  }
}

function header(writer: Writer, type: number, srid?: number): void {
  writer.byte(LITTLE_ENDIAN);
  writer.uint32(srid === undefined ? type : type | SRID_FLAG);

  if (srid !== undefined) writer.uint32(srid);
}

function polygonBody(writer: Writer, rings: readonly (readonly Position[])[]): void {
  writer.uint32(rings.length);

  for (const ring of rings) writer.points(ring);
}

/** EWKB (little endian) z numerem ukladu `srid`, szesnastkowo - gotowe do `'<hex>'::geometry`. */
export function toEwkbHex(geometry: HydroGeometry, srid: number): string {
  const writer = new Writer();

  header(writer, WKB_TYPE[geometry.type], srid);

  switch (geometry.type) {
    case 'Point': {
      writer.point(geometry.coordinates);
      break;
    }

    case 'LineString': {
      writer.points(geometry.coordinates);
      break;
    }

    case 'Polygon': {
      polygonBody(writer, geometry.coordinates);
      break;
    }

    case 'MultiLineString': {
      writer.uint32(geometry.coordinates.length);

      for (const line of geometry.coordinates) {
        header(writer, WKB_TYPE.LineString);
        writer.points(line);
      }

      break;
    }

    case 'MultiPolygon': {
      writer.uint32(geometry.coordinates.length);

      for (const polygon of geometry.coordinates) {
        header(writer, WKB_TYPE.Polygon);
        polygonBody(writer, polygon);
      }

      break;
    }
  }

  return writer.hex();
}
