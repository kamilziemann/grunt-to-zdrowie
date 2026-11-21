// Kursor paginacji: base64url(JSON). Nieprawidlowy kursor = null (lista od poczatku), nie blad.
// Stronicowanie keyset: repozytorium pobiera `limit + 1` wierszy po pozycji z kursora `{ <pole sortowania>, id }`.
import type { Page } from '@app/contracts';

/** Pozycja keyset: wartosc pola sortowania i id, ktore rozstrzyga remisy (np. ten sam `createdAt`). */
export type KeysetPosition<K extends string> = { [P in K]: string } & { id: string };

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = '';

  for (const b of bytes) bin += String.fromCharCode(b);

  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string | null {
  try {
    const padded = input.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (input.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeCursor(value: Record<string, string>): string {
  return toBase64Url(JSON.stringify(value));
}

export function decodeCursor(cursor: string | undefined): Record<string, string> | null {
  if (!cursor) return null;
  const text = fromBase64Url(cursor);

  if (text === null) return null;

  try {
    const parsed: unknown = JSON.parse(text);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};

    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== 'string') return null;
      out[k] = v;
    }

    return out;
  } catch {
    return null;
  }
}

/** Pozycja „po” z kursora strony; brak, uszkodzony albo niepelny kursor (bez pola lub id) = lista od poczatku. */
export function keysetAfter<K extends string>(
  cursor: string | undefined,
  field: K,
): KeysetPosition<K> | null {
  const decoded = decodeCursor(cursor);
  const value = decoded?.[field];

  if (!value || !decoded?.id) return null;

  return { [field]: value, id: decoded.id } as KeysetPosition<K>;
}

/** Strona z `limit + 1` wierszy: nadmiarowy wiersz = jest nastepna, a kursor wskazuje ostatni pokazany wiersz. */
export function keysetPage<K extends string, T extends KeysetPosition<K>>(
  rows: T[],
  limit: number,
  field: K,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);

  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ [field]: last[field], id: last.id }) : null,
  };
}
