import { afterEach, describe, expect, it, vi } from 'vitest';

import { revealField } from './reveal-field';

function stubMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduced && query.includes('reduce') })),
  );
}

describe('revealField', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('przewija obszar plynnie i daje fokus bez drugiego przewiniecia', () => {
    stubMotion(false);

    const area = document.createElement('div');
    const input = document.createElement('input');
    const scroll = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    const focus = vi.spyOn(input, 'focus');

    area.scrollIntoView = scroll;
    area.append(input);
    document.body.append(area);
    revealField(area, input);

    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(input);
    area.remove();
  });

  it('przy ograniczonym ruchu przewija bez animacji', () => {
    stubMotion(true);

    const area = document.createElement('div');
    const scroll = vi.fn<(options?: ScrollIntoViewOptions) => void>();

    area.scrollIntoView = scroll;
    revealField(area, null, { block: 'center' });

    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });
});
