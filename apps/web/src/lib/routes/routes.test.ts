import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, isNavItemActive, routes } from './routes';

describe('routes', () => {
  it('lista działek trafia do parametru `dzialki` (zakodowana), bez niej adres jest czysty', () => {
    expect(routes.analysis('141201_1.0001.12/3')).toBe('/analiza?dzialki=141201_1.0001.12%2F3');
    expect(routes.parcels('141201_1.0001.12/3')).toBe('/mapa?dzialki=141201_1.0001.12%2F3');
    expect(routes.analysis()).toBe('/analiza');
    expect(routes.parcels()).toBe('/mapa');
    expect(routes.map({ widok: '1,2,3,4', rysuj: 'podziel' })).toBe(
      '/mapa?widok=1%2C2%2C3%2C4&rysuj=podziel',
    );
  });

  it('sekcja nawigacji jest aktywna na swojej stronie i podstronach, strona główna nie aktywuje żadnej', () => {
    const design = NAV_ITEMS.find((item) => item.labelKey === 'design');

    expect(design && isNavItemActive(design, '/design')).toBe(true);
    expect(design && isNavItemActive(design, '/design/kolory')).toBe(true);
    expect(design && isNavItemActive(design, '/designer')).toBe(false);
    expect(NAV_ITEMS.some((item) => isNavItemActive(item, '/'))).toBe(false);
  });
});
