import { describe, expect, it } from 'vitest';

import { normalizeText } from './normalize-text';

describe('normalizeText', () => {
  it('usuwa wielkie litery, polskie znaki i nadmiarowe odstępy', () => {
    expect(normalizeText('  Składka   ZDROWOTNA łódź ')).toBe('skladka zdrowotna lodz');
    expect(normalizeText('Rondo Grzegórzeckie')).toBe('rondo grzegorzeckie');
  });
});
