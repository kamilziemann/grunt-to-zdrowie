import type { Parcel } from '@app/contracts';
import { AppError } from '@app/http';
import { describe, expect, it } from 'vitest';

import type { VegetationImageRequest, VegetationImagerySource } from './ports';
import { createImageryService, toBase64 } from './imagery.service';

const NOW = '2026-11-21T10:00:00.000Z';

function parcel(id: string, west: number): Parcel {
  return {
    id,
    number: id.slice(-4),
    region: 'Obreb',
    commune: 'Gmina',
    county: 'Powiat',
    voivodeship: 'mazowieckie',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, 52],
          [west + 0.01, 52],
          [west + 0.01, 52.01],
          [west, 52],
        ],
      ],
    },
    bbox: [west, 52, west + 0.01, 52.01],
    centroid: [west + 0.005, 52.005],
    areaHa: 1,
    source: 'uldk',
    fetchedAt: NOW,
  };
}

const PARCELS = new Map([
  ['141201_1.0001.1', parcel('141201_1.0001.1', 21)],
  ['141201_1.0001.2', parcel('141201_1.0001.2', 21.01)],
]);

const lookup = {
  get: (id: string) => {
    const found = PARCELS.get(id);

    return found ? Promise.resolve(found) : Promise.reject(AppError.notFound('Parcel', id));
  },
};

function source(result: 'image' | 'none', requests: VegetationImageRequest[] = []): VegetationImagerySource {
  return {
    render: (request) => {
      requests.push(request);

      return Promise.resolve(
        result === 'none'
          ? null
          : {
              tiles: request.parts.map((part) => ({ png: new Uint8Array([1, 2, 3]), bbox: part.bbox })),
              sceneDate: '2025-06-15',
              sceneCloudCover: 0,
              clearShare: 0.98,
              low: 0.6,
              high: 0.85,
              mean: 0.77,
            },
      );
    },
  };
}

describe('imagery service', () => {
  it('sklada pole z dzialek i oddaje obraz z zasiegiem i dniem sceny', async () => {
    const requests: VegetationImageRequest[] = [];
    const service = createImageryService({
      parcels: lookup,
      source: source('image', requests),
      now: () => NOW,
    });
    const result = await service.vegetation({ parcelIds: [...PARCELS.keys()], date: '2025-07-01' });

    expect(result.images).toHaveLength(2);
    expect(result).toMatchObject({
      images: [{ image: `data:image/png;base64,${toBase64(new Uint8Array([1, 2, 3]))}` }, {}],
      requestedDate: '2025-07-01',
      sceneDate: '2025-06-15',
      layer: 'condition',
      scale: { low: 0.6, high: 0.85, mean: 0.77 },
    });
    expect(requests[0]?.index).toBe('ndvi');
    expect(requests[0]?.parts.map((part) => part.geometry.type)).toEqual(['Polygon', 'Polygon']);
    expect(requests[0]?.windowDays).toBe(30);

    const [west, , east] = result.bbox;

    expect(west).toBeLessThan(21);
    expect(east).toBeGreaterThan(21.02);
  });

  it('warstwa wody w roslinach liczy NDMI', async () => {
    const requests: VegetationImageRequest[] = [];
    const service = createImageryService({
      parcels: lookup,
      source: source('image', requests),
      now: () => NOW,
    });
    const result = await service.vegetation({ parcelIds: [...PARCELS.keys()], layer: 'moisture' });

    expect(result.layer).toBe('moisture');
    expect(requests[0]?.index).toBe('ndmi');
  });

  it('bez daty bierze dzisiejszy dzien w Polsce', async () => {
    const requests: VegetationImageRequest[] = [];
    const service = createImageryService({
      parcels: lookup,
      source: source('image', requests),
      now: () => NOW,
    });

    await service.vegetation({ parcelIds: ['141201_1.0001.1'] });

    expect(requests[0]?.date).toBe('2026-11-21');
  });

  it('brak czystej sceny = 404 z powodem no_clear_scene', async () => {
    const service = createImageryService({ parcels: lookup, source: source('none'), now: () => NOW });

    await expect(service.vegetation({ parcelIds: ['141201_1.0001.1'] })).rejects.toMatchObject({
      code: 'not_found',
      reason: 'no_clear_scene',
    });
  });

  it('data z przyszlosci albo bez dzialek = blad walidacji', async () => {
    const service = createImageryService({ parcels: lookup, source: source('image'), now: () => NOW });

    await expect(
      service.vegetation({ parcelIds: ['141201_1.0001.1'], date: '2026-12-01' }),
    ).rejects.toMatchObject({
      code: 'validation_failed',
    });
    await expect(service.vegetation({ parcelIds: [] })).rejects.toMatchObject({ code: 'validation_failed' });
  });
});
