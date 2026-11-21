import { describe, expect, it } from 'vitest';

import { createId } from './ids';

describe('createId', () => {
  it('ma prefiks i 12 znakow losowych', () => {
    const id = createId('par');

    expect(id).toMatch(/^par_[0-9a-z]{12}$/);
    expect(createId('par')).not.toBe(id);
  });
});
