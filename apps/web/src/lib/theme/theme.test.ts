import { describe, expect, it } from 'vitest';

import { nextTheme, parseTheme, themeAttribute, themeCookie } from './theme';

describe('theme', () => {
  it('parseTheme zna trzy wartosci, resztę traktuje jak system', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('system')).toBe('system');
    expect(parseTheme('neon')).toBe('system');
    expect(parseTheme(undefined)).toBe('system');
  });

  it('themeAttribute ustawia atrybut tylko dla wymuszonego motywu', () => {
    expect(themeAttribute('system')).toBeUndefined();
    expect(themeAttribute('dark')).toBe('dark');
  });

  it('nextTheme przechodzi cyklicznie system -> light -> dark -> system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('themeCookie zawiera ścieżkę i czas życia', () => {
    expect(themeCookie('dark')).toMatch(/^theme=dark; path=\/; max-age=\d+; samesite=lax$/);
  });
});
