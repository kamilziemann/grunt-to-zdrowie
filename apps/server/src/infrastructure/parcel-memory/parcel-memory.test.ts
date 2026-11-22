import { describe, expect, it } from 'vitest';

import type {
  ParcelMemoryStore,
  ParcelRecord,
  ParcelSource,
  StoredParcelRecord,
} from '../../domain/parcel-source';
import { withParcelMemory } from './parcel-memory';

const ID = '080904_5.0001.349/1';

const record: ParcelRecord = {
  id: ID,
  number: '349/1',
  region: 'Chwalim',
  commune: 'Kargowa',
  county: 'zielonogórski',
  voivodeship: 'lubuskie',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [15.86, 52.06],
        [15.87, 52.06],
        [15.87, 52.07],
        [15.86, 52.06],
      ],
    ],
  },
  origin: 'uldk',
};

/** GUGiK w pamieci: licznik zapytan i przelacznik awarii. */
function gugik(answer: ParcelRecord | null = record) {
  const state = { calls: 0, down: false };
  const respond = async (): Promise<ParcelRecord | null> => {
    state.calls += 1;

    if (state.down) throw new Error('ULDK: 302, WFS: timeout');

    return answer;
  };
  const source: ParcelSource = {
    byId: respond,
    byPoint: respond,
    byName: async () => ({ total: 0, items: [] }),
  };

  return { state, source };
}

function memoryStore(behaviour: 'ok' | 'broken' | 'hanging' = 'ok') {
  const rows = new Map<string, StoredParcelRecord>();
  const store: ParcelMemoryStore = {
    async get(id) {
      if (behaviour === 'broken') throw new Error('D1_ERROR');

      if (behaviour === 'hanging') return new Promise(() => {});

      return rows.get(id) ?? null;
    },
    async put(id, value) {
      if (behaviour === 'broken') throw new Error('D1_ERROR');

      rows.set(id, value);
    },
  };

  return { rows, store };
}

const clock = (start: string) => {
  const state = { now: start };

  return { state, now: () => state.now };
};

describe('withParcelMemory', () => {
  it('drugi odczyt tej samej dzialki idzie z pamieci, bez pytania GUGiK', async () => {
    const { state, source } = gugik();
    const { rows, store } = memoryStore();
    const time = clock('2026-11-22T02:00:00.000Z');
    const parcels = withParcelMemory(source, { store, now: time.now });

    expect((await parcels.byId(ID))?.number).toBe('349/1');
    expect(rows.get(ID)?.fetchedAt).toBe('2026-11-22T02:00:00.000Z');

    time.state.now = '2026-12-10T02:00:00.000Z';
    state.down = true;

    const again = await parcels.byId(ID);

    expect(state.calls).toBe(1);
    expect(again).toMatchObject({ number: '349/1', fetchedAt: '2026-11-22T02:00:00.000Z' });
    expect(again?.stale).toBeUndefined();
  });

  it('wpis starszy niz 30 dni odswieza sie z GUGiK', async () => {
    const { state, source } = gugik();
    const { rows, store } = memoryStore();
    const time = clock('2026-10-01T12:00:00.000Z');
    const parcels = withParcelMemory(source, { store, now: time.now });

    await parcels.byId(ID);
    time.state.now = '2026-11-22T12:00:00.000Z';
    await parcels.byId(ID);

    expect(state.calls).toBe(2);
    expect(rows.get(ID)?.fetchedAt).toBe('2026-11-22T12:00:00.000Z');
  });

  it('stary wpis i GUGiK nie odpowiada: oddaje stary wpis z data pobrania zamiast bledu', async () => {
    const { state, source } = gugik();
    const { store } = memoryStore();
    const time = clock('2026-09-01T12:00:00.000Z');
    const parcels = withParcelMemory(source, { store, now: time.now });

    await parcels.byId(ID);
    time.state.now = '2026-11-22T02:00:00.000Z';
    state.down = true;

    expect(await parcels.byId(ID)).toMatchObject({ fetchedAt: '2026-09-01T12:00:00.000Z', stale: true });
  });

  it('bez wpisu awaria GUGiK idzie dalej jako blad; "nie ma dzialki" nie trafia do pamieci', async () => {
    const down = gugik();
    const missing = gugik(null);
    const { rows, store } = memoryStore();
    const now = () => '2026-11-22T02:00:00.000Z';

    down.state.down = true;
    await expect(withParcelMemory(down.source, { store, now }).byId(ID)).rejects.toThrow('ULDK');
    expect(await withParcelMemory(missing.source, { store, now }).byId(ID)).toBeNull();
    expect(rows.size).toBe(0);
  });

  it('zepsuta albo zawieszona pamiec nie psuje odczytu - pytamy GUGiK jak bez niej', async () => {
    const errors: string[] = [];
    const now = () => '2026-11-22T02:00:00.000Z';
    const onError = (_: unknown, operation: string) => errors.push(operation);

    const broken = withParcelMemory(gugik().source, { store: memoryStore('broken').store, now, onError });

    expect((await broken.byId(ID))?.id).toBe(ID);
    expect(errors).toEqual(['get', 'put']);

    const hanging = withParcelMemory(gugik().source, { store: memoryStore('hanging').store, now });

    expect((await hanging.byId(ID))?.id).toBe(ID);
  }, 5000);

  it('dzialka wskazana na mapie trafia do pamieci pod swoim numerem; zapis moze isc w tle', async () => {
    const { state, source } = gugik();
    const { rows, store } = memoryStore();
    const deferred: Promise<unknown>[] = [];
    const parcels = withParcelMemory(source, {
      store,
      now: () => '2026-11-22T02:00:00.000Z',
      defer: (task) => deferred.push(task),
    });

    await parcels.byPoint(15.865, 52.065);
    await Promise.all(deferred);
    expect(rows.has(ID)).toBe(true);

    await parcels.byId(ID);
    expect(state.calls).toBe(1);
  });
});
