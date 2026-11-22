import { hashKey } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { queryKeys } from './keys';

describe('queryKeys', () => {
  it('są stabilne: ten sam klucz daje ten sam hash', () => {
    expect(hashKey(queryKeys.health)).toBe(hashKey(['health']));
  });
});
