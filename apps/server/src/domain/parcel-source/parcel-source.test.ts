import { describe, expect, it, vi } from 'vitest';

import {
  withFallback,
  withRegistryLandUse,
  type ParcelRecord,
  type ParcelRegistryEntry,
  type ParcelSource,
} from './parcel-source';

const record = (origin: ParcelRecord['origin']): ParcelRecord => ({
  id: '141201_1.0001.6509',
  number: '6509',
  region: 'Mińsk Mazowiecki',
  commune: 'Mińsk Mazowiecki',
  county: '',
  voivodeship: 'mazowieckie',
  geometry: { type: 'Polygon', coordinates: [] },
  origin,
});

function source(origin: ParcelRecord['origin'], behaviour: 'ok' | 'missing' | 'down'): ParcelSource {
  const answer = (): Promise<ParcelRecord | null> =>
    behaviour === 'down'
      ? Promise.reject(new Error(`${origin} down`))
      : Promise.resolve(behaviour === 'ok' ? record(origin) : null);

  return {
    byId: answer,
    byPoint: answer,
    byName: () =>
      behaviour === 'down'
        ? Promise.reject(new Error(`${origin} down`))
        : Promise.resolve({ total: 1, items: [record(origin)] }),
  };
}

describe('withFallback', () => {
  it('pyta zapas dopiero po awarii zrodla podstawowego', async () => {
    const healthy = withFallback(source('uldk', 'ok'), source('egib-wfs', 'ok'));
    const degraded = withFallback(source('uldk', 'down'), source('egib-wfs', 'ok'));

    expect((await healthy.byId('x'))?.origin).toBe('uldk');
    expect((await degraded.byId('x'))?.origin).toBe('egib-wfs');
    expect((await degraded.byPoint(21, 52))?.origin).toBe('egib-wfs');
  });

  it('brak dzialki w zrodle podstawowym to odpowiedz, nie powod do pytania zapasu', async () => {
    const sources = withFallback(source('uldk', 'missing'), source('egib-wfs', 'ok'));

    expect(await sources.byId('x')).toBeNull();
  });

  it('szukanie po nazwie nie ma zapasu', async () => {
    const sources = withFallback(source('uldk', 'down'), source('egib-wfs', 'ok'));

    await expect(sources.byName('Dąbrowa 12', 10)).rejects.toThrow('uldk down');
  });
});

describe('withRegistryLandUse', () => {
  const registry = (entry: { landUse: string[]; registryAreaHa?: number } | null) => ({
    byId: vi.fn<(id: string) => Promise<ParcelRegistryEntry | null>>(() => Promise.resolve(entry)),
  });

  it('dopisuje uzytki z ewidencji do dzialki z ULDK i oddaje rekord do zapamietania', async () => {
    const onEnriched = vi.fn<(record: ParcelRecord) => void>();
    const sources = withRegistryLandUse(
      source('uldk', 'ok'),
      registry({ landUse: ['Ls'], registryAreaHa: 0.27 }),
      { timeoutMs: 50, onEnriched },
    );

    const found = await sources.byId('x');

    expect(found).toMatchObject({ origin: 'uldk', landUse: ['Ls'], registryAreaHa: 0.27 });
    expect(onEnriched).toHaveBeenCalledWith(found);
  });

  it('nie pyta ewidencji, gdy rekord ma juz uzytki, i nie dopytuje dzialki pod punktem', async () => {
    const withLandUse: ParcelSource = {
      ...source('egib-wfs', 'ok'),
      byId: () => Promise.resolve({ ...record('egib-wfs'), landUse: ['RIVa'] }),
    };
    const egib = registry({ landUse: ['Ls'] });
    const sources = withRegistryLandUse(withLandUse, egib, { timeoutMs: 50 });

    expect((await sources.byId('x'))?.landUse).toEqual(['RIVa']);
    expect((await sources.byPoint(21, 52))?.landUse).toBeUndefined();
    expect(egib.byId).not.toHaveBeenCalled();
  });

  it('oddaje dzialke bez uzytkow, gdy ewidencja milczy, nie zna dzialki albo zglasza blad', async () => {
    const onEnriched = vi.fn<(record: ParcelRecord) => void>();
    const silent = { byId: () => new Promise<null>(() => {}) };
    const broken = { byId: () => Promise.reject(new Error('wfs down')) };
    const options = { timeoutMs: 10, onEnriched };

    for (const egib of [silent, broken, registry(null)]) {
      const found = await withRegistryLandUse(source('uldk', 'ok'), egib, options).byId('x');

      expect(found).toEqual(record('uldk'));
    }

    expect(onEnriched).not.toHaveBeenCalled();
  });
});
