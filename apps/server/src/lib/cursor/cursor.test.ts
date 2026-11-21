import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor, keysetAfter, keysetPage } from './cursor';

describe('cursor', () => {
  it('koduje i dekoduje base64url', () => {
    const cursor = encodeCursor({ updatedAt: '2026-10-15T10:00:00.000Z', id: 'par_abc' });

    expect(cursor).not.toMatch(/[+/=]/);
    expect(decodeCursor(cursor)).toEqual({ updatedAt: '2026-10-15T10:00:00.000Z', id: 'par_abc' });
  });

  it('smieci daja null zamiast bledu', () => {
    expect(decodeCursor('***')).toBeNull();
    expect(decodeCursor(btoa('[1,2]'))).toBeNull();
    expect(decodeCursor(btoa('{"a":1}'))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe('keysetPage', () => {
  const rows = [
    { id: 'c', createdAt: '2026-10-21T10:00:00.000Z' },
    { id: 'b', createdAt: '2026-10-21T09:00:00.000Z' },
    { id: 'a', createdAt: '2026-10-21T09:00:00.000Z' },
  ];

  it('nadmiarowy wiersz ucina strone i daje kursor na ostatni pokazany wiersz', () => {
    const page = keysetPage(rows, 2, 'createdAt');

    expect(page.items.map((row) => row.id)).toEqual(['c', 'b']);
    expect(keysetAfter(page.nextCursor ?? undefined, 'createdAt')).toEqual({
      createdAt: '2026-10-21T09:00:00.000Z',
      id: 'b',
    });
  });

  it('bez nadmiarowego wiersza to ostatnia strona', () => {
    expect(keysetPage(rows, 3, 'createdAt')).toEqual({ items: rows, nextCursor: null });
    expect(keysetPage([], 3, 'createdAt')).toEqual({ items: [], nextCursor: null });
  });
});

describe('keysetAfter', () => {
  it('brak, smieci albo niepelny kursor = lista od poczatku', () => {
    expect(keysetAfter(undefined, 'createdAt')).toBeNull();
    expect(keysetAfter('***', 'createdAt')).toBeNull();
    expect(keysetAfter(encodeCursor({ createdAt: '2026-10-21T09:00:00.000Z' }), 'createdAt')).toBeNull();
    expect(keysetAfter(encodeCursor({ id: 'b' }), 'createdAt')).toBeNull();
    expect(keysetAfter(encodeCursor({ createdAt: '', id: 'b' }), 'createdAt')).toBeNull();
  });

  it('kursor innej listy (inne pole sortowania) nie przesuwa strony', () => {
    const runsCursor = encodeCursor({ startedAt: '2026-10-21T09:00:00.000Z', id: 'run_1' });

    expect(keysetAfter(runsCursor, 'createdAt')).toBeNull();
    expect(keysetAfter(runsCursor, 'startedAt')).toEqual({
      startedAt: '2026-10-21T09:00:00.000Z',
      id: 'run_1',
    });
  });

  it('zwraca tylko pole sortowania i id, bez dodatkowych kluczy z kursora', () => {
    const cursor = encodeCursor({ createdAt: '2026-10-21T09:00:00.000Z', id: 'b', status: 'failed' });

    expect(keysetAfter(cursor, 'createdAt')).toEqual({ createdAt: '2026-10-21T09:00:00.000Z', id: 'b' });
  });
});
