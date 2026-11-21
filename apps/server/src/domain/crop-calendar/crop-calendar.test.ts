import { describe, expect, it } from 'vitest';

import { cropAtDate } from './crop-calendar';

describe('cropAtDate', () => {
  it('kukurydza: przed siewem, rozwoj, pelnia, koniec, po zbiorze', () => {
    expect(cropAtDate('maize_grain', '2026-04-01')).toMatchObject({ stage: 'dormant', kc: null });
    expect(cropAtDate('maize_grain', '2026-05-10')).toMatchObject({ stage: 'initial', kc: 0.3 });
    expect(cropAtDate('maize_grain', '2026-06-14')).toMatchObject({ stage: 'development' });
    expect(cropAtDate('maize_grain', '2026-07-20')).toMatchObject({ stage: 'mid', kc: 1.2, rootDepthM: 1.5 });
    expect(cropAtDate('maize_grain', '2026-09-20').stage).toBe('late');
    expect(cropAtDate('maize_grain', '2026-11-21')).toMatchObject({ stage: 'harvested', kc: null });
  });

  it('Kc w rozwoju rosnie liniowo miedzy poczatkiem a pelnia', () => {
    const kc = cropAtDate('maize_grain', '2026-06-14').kc ?? 0;

    expect(kc).toBeGreaterThan(0.3);
    expect(kc).toBeLessThan(1.2);
  });

  it('ozimina zima jest w spoczynku, a wiosna ma juz glebokie korzenie', () => {
    expect(cropAtDate('winter_wheat', '2026-01-15')).toMatchObject({
      stage: 'dormant',
      iungGroup: 'winter_cereals',
    });
    expect(cropAtDate('winter_wheat', '2026-11-21').stage).toBe('dormant');
    expect(cropAtDate('winter_wheat', '2026-04-01')).toMatchObject({ stage: 'initial', rootDepthM: 1.5 });
  });

  it('uzytki zielone nie maja grupy progow IUNG', () => {
    expect(cropAtDate('grassland', '2026-06-15')).toMatchObject({ iungGroup: null, stage: 'mid' });
  });
});
