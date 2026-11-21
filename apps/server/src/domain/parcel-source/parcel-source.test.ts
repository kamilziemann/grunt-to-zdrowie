import { describe, expect, it } from 'vitest';

import { withFallback, type ParcelRecord, type ParcelSource } from './parcel-source';

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
