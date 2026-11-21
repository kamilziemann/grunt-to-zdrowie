import { describe, expect, it } from 'vitest';

import { redactPath } from './redact';

describe('redactPath', () => {
  it('ukrywa tokeny w sciezkach auth, reszte zostawia', () => {
    expect(redactPath('/api/auth/reset-password/abc.def?callbackURL=/x')).toBe(
      '/api/auth/reset-password/[redacted]?callbackURL=/x',
    );
    expect(redactPath('/articles/skladka-2027')).toBe('/articles/skladka-2027');
  });
});
