import { describe, expect, it } from 'vitest';

import { validateSignInForm, validateSignUpForm } from './auth-form.schema';

describe('validateSignInForm', () => {
  it('przepuszcza poprawne dane i przycina e-mail', () => {
    expect(validateSignInForm({ email: ' a@b.pl ', password: 'x' })).toEqual({
      ok: true,
      data: { email: 'a@b.pl', password: 'x' },
    });
  });

  it('oznacza pola z bledem', () => {
    expect(validateSignInForm({ email: 'zly', password: '' })).toEqual({
      ok: false,
      errors: { email: true, password: true },
    });
  });
});

describe('validateSignUpForm', () => {
  it('wymaga imienia, e-maila i hasla 8+ znakow', () => {
    expect(validateSignUpForm({ name: '', email: 'a@b.pl', password: 'krotkie' })).toEqual({
      ok: false,
      errors: { name: true, password: true },
    });
    expect(validateSignUpForm({ name: 'Ala', email: 'a@b.pl', password: 'dlugie-haslo' }).ok).toBe(true);
  });
});
