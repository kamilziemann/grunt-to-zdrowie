import type { Identity } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import {
  allOf,
  anyOf,
  decide,
  hasAllRoles,
  hasAnyRole,
  isAuthenticated,
  isOwner,
  type Policy,
  ROLES,
} from './authorization';

const admin: Identity = { userId: 'u1', email: 'a@x.pl', roles: ['admin', 'editor'] };
const plain: Identity = { userId: 'u2', email: 'b@x.pl', roles: [] };

describe('polityki', () => {
  it('isAuthenticated: tylko zalogowany', () => {
    expect([isAuthenticated(null), isAuthenticated(plain)]).toEqual([false, true]);
  });

  it('hasAnyRole / hasAllRoles', () => {
    expect([hasAnyRole('admin')(admin), hasAnyRole('admin')(plain), hasAnyRole('admin')(null)]).toEqual([
      true,
      false,
      false,
    ]);
    expect([hasAllRoles('admin', 'editor')(admin), hasAllRoles('admin', 'x')(admin)]).toEqual([true, false]);
  });

  it('isOwner porownuje wlasciciela zasobu z userId; brak zasobu = brak dostepu', () => {
    const policy = isOwner<{ ownerId: string }>((r) => r.ownerId);

    expect([
      policy(admin, { ownerId: 'u1' }),
      policy(plain, { ownerId: 'u1' }),
      policy(admin),
      policy(null, { ownerId: 'u1' }),
    ]).toEqual([true, false, false, false]);
  });

  it('anyOf / allOf skladaja polityki', () => {
    const owner = isOwner<{ ownerId: string }>((r) => r.ownerId);
    const either = anyOf(hasAnyRole('admin'), owner);
    const both = allOf(isAuthenticated as Policy<{ ownerId: string }>, owner);

    expect([
      either(admin, { ownerId: 'x' }),
      either(plain, { ownerId: 'u2' }),
      either(plain, { ownerId: 'x' }),
    ]).toEqual([true, true, false]);
    expect([both(plain, { ownerId: 'u2' }), both(plain, { ownerId: 'u1' })]).toEqual([true, false]);
    expect([anyOf()(admin), allOf()(null)]).toEqual([false, true]);
  });
});

describe('decide', () => {
  it('rozroznia allow / unauthenticated / forbidden', () => {
    const policy = hasAnyRole('admin');

    expect([decide(policy, admin), decide(policy, null), decide(policy, plain)]).toEqual([
      'allow',
      'unauthenticated',
      'forbidden',
    ]);
  });
});

describe('role zespolu', () => {
  const editor: Identity = { userId: 'u3', email: 'c@x.pl', roles: ['editor'] };
  const chief: Identity = { userId: 'u4', email: 'd@x.pl', roles: ['admin'] };

  it('polityka tylko dla administratora', () => {
    const adminOnly = hasAnyRole(ROLES.admin);

    expect([null, plain, editor, chief].map((who) => adminOnly(who))).toEqual([false, false, false, true]);
  });

  it('polityka dla redaktora i administratora', () => {
    const staff = hasAnyRole(ROLES.editor, ROLES.admin);

    expect([null, plain, editor, chief].map((who) => staff(who))).toEqual([false, false, true, true]);
  });
});
