import { describe, expect, it } from 'vitest';

import { confidenceOf } from './confidence';

describe('confidenceOf', () => {
  it('bez zastrzezen wysoka, jedno - srednia, dwa i wiecej - niska', () => {
    expect(confidenceOf([])).toBe('high');
    expect(confidenceOf(['coarse_meteo_grid'])).toBe('medium');
    expect(confidenceOf(['coarse_meteo_grid', 'soil_unknown'])).toBe('low');
    expect(confidenceOf(['coarse_meteo_grid', 'soil_unknown', 'conflicting_signals'])).toBe('low');
  });

  it('to samo zastrzezenie liczy sie raz, a brak bilansu zawsze daje niska', () => {
    expect(confidenceOf(['meteo_gaps', 'meteo_gaps'])).toBe('medium');
    expect(confidenceOf(['no_balance'])).toBe('low');
  });
});
