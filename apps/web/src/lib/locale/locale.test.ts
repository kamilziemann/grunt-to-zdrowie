import { describe, expect, it } from 'vitest';

import {
  asLocale,
  delocalizePath,
  ENABLED_LOCALES,
  isDisabledLocaleParam,
  localeFromParam,
  localeFromPath,
  localizePath,
} from './locale';

describe('locale', () => {
  it('asLocale zna pl i en', () => {
    expect(asLocale('pl')).toBe('pl');
    expect(asLocale('en')).toBe('en');
    expect(asLocale('de')).toBeUndefined();
    expect(asLocale(undefined)).toBeUndefined();
  });

  it('parametr trasy: brak = pl, en tylko gdy wlaczony, pl jawnie albo nieznany = 404', () => {
    expect(localeFromParam(undefined)).toBe('pl');
    expect(localeFromParam('en')).toBe(ENABLED_LOCALES.includes('en') ? 'en' : undefined);
    expect(localeFromParam('pl')).toBeUndefined();
    expect(localeFromParam('analiza')).toBeUndefined();
  });

  it('wylaczony jezyk z tlumaczeniami jest rozpoznawany (trasa przekierowuje), nieznany i domyslny nie', () => {
    expect(isDisabledLocaleParam('en')).toBe(!ENABLED_LOCALES.includes('en'));
    expect(isDisabledLocaleParam('pl')).toBe(false);
    expect(isDisabledLocaleParam('analiza')).toBe(false);
    expect(isDisabledLocaleParam(undefined)).toBe(false);
  });

  it('jezyk ze sciezki i sciezka bez prefiksu', () => {
    expect(localeFromPath('/en/analiza/p1')).toBe('en');
    expect(localeFromPath('/analiza')).toBe('pl');
    expect(delocalizePath('/en/analiza/p1')).toBe('/analiza/p1');
    expect(delocalizePath('/en')).toBe('/');
    expect(delocalizePath('/english-page')).toBe('/english-page');
  });

  it('localizePath dokleja prefiks, zachowuje query i # oraz pomija /api i adresy zewnetrzne', () => {
    expect(localizePath('/analiza?dzialki=12', 'en')).toBe('/en/analiza?dzialki=12');
    expect(localizePath('/', 'en')).toBe('/en');
    expect(localizePath('/en/account', 'pl')).toBe('/account');
    expect(localizePath('/account#sekcja', 'en')).toBe('/en/account#sekcja');
    expect(localizePath('/api/parcels/search', 'en')).toBe('/api/parcels/search');
    expect(localizePath('https://example.com', 'en')).toBe('https://example.com');
  });
});
