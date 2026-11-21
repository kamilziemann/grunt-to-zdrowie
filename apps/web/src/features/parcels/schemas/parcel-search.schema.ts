// Walidacja pola wyszukiwania dzialki: schemat z @app/contracts (ten sam waliduje API), tu tylko mapowanie na klucz
// komunikatu dla rolnika.
import { PARCEL_LIMITS, parcelSearchQuerySchema } from '@app/contracts';

export type ParcelSearchError = 'tooShort' | 'tooLong';

export type ParcelSearchInput = { ok: true; query: string } | { ok: false; error: ParcelSearchError };

export function validateParcelSearch(raw: string): ParcelSearchInput {
  const parsed = parcelSearchQuerySchema.safeParse({ q: raw });

  if (parsed.success) return { ok: true, query: parsed.data.q };

  return { ok: false, error: raw.trim().length > PARCEL_LIMITS.queryMax ? 'tooLong' : 'tooShort' };
}
