import type { Identity } from '@app/contracts';
import { AppError } from '@app/http';
import { describe, expect, it } from 'vitest';

import { hasAnyRole, isAuthenticated, isOwner } from '../../domain/authorization';
import { authorize } from './authorization';

const reader: Identity = { userId: 'u1', email: 'a@x.pl', roles: [] };

function caught(run: () => void): AppError | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error;

    throw error;
  }

  return undefined;
}

describe('authorize', () => {
  it('przepuszcza, gdy polityka pozwala', () => {
    expect(caught(() => authorize(isAuthenticated, reader))).toBeUndefined();
  });

  it('bez tożsamości rzuca 401 unauthorized', () => {
    const error = caught(() => authorize(isAuthenticated, null));

    expect([error?.code, error?.status, error?.expose]).toEqual(['unauthorized', 401, true]);
  });

  it('zalogowany bez uprawnień dostaje 403 forbidden', () => {
    const error = caught(() => authorize(hasAnyRole('admin'), reader));

    expect([error?.code, error?.status]).toEqual(['forbidden', 403]);
  });

  it('sprawdza właściciela przekazanego zasobu', () => {
    const owned = isOwner<{ ownerId: string }>((field) => field.ownerId);

    expect(caught(() => authorize(owned, reader, { ownerId: 'u1' }))).toBeUndefined();
    expect(caught(() => authorize(owned, reader, { ownerId: 'u2' }))?.code).toBe('forbidden');
  });
});
