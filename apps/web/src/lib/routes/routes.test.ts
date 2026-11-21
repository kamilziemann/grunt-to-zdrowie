import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, isNavItemActive, routes, safeNextPath } from './routes';

describe('routes', () => {
  it('lista działek trafia do parametru `dzialki` (zakodowana), bez niej adres jest czysty', () => {
    expect(routes.analysis('141201_1.0001.12/3')).toBe('/analiza?dzialki=141201_1.0001.12%2F3');
    expect(routes.parcels('141201_1.0001.12/3')).toBe('/?dzialki=141201_1.0001.12%2F3');
    expect(routes.analysis()).toBe('/analiza');
    expect(routes.parcels()).toBe('/');
  });

  it('sekcja nawigacji jest aktywna na swojej stronie i podstronach, strona główna nie aktywuje żadnej', () => {
    const design = NAV_ITEMS.find((item) => item.labelKey === 'design');

    expect(design && isNavItemActive(design, '/design')).toBe(true);
    expect(design && isNavItemActive(design, '/design/kolory')).toBe(true);
    expect(design && isNavItemActive(design, '/designer')).toBe(false);
    expect(NAV_ITEMS.some((item) => isNavItemActive(item, '/'))).toBe(false);
  });

  it('signIn niesie sciezke powrotu, bez niej czysty adres', () => {
    expect(routes.signIn()).toBe('/sign-in');
    expect(routes.signIn('/account?tab=sesje')).toBe('/sign-in?next=%2Faccount%3Ftab%3Dsesje');
  });

  it('safeNextPath przepuszcza tylko sciezki tej aplikacji', () => {
    expect(safeNextPath('/analiza?dzialki=a#x')).toBe('/analiza?dzialki=a#x');
    expect(safeNextPath('https://zly.example/')).toBeNull();
    expect(safeNextPath('//zly.example/admin')).toBeNull();
    expect(safeNextPath(String.raw`/\zly.example`)).toBeNull();
    expect(safeNextPath('admin')).toBeNull();
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(routes.signIn('https://zly.example/')).toBe('/sign-in');
  });
});
