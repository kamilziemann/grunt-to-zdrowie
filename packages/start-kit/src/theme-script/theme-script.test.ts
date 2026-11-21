import { afterEach, describe, expect, it } from 'vitest';

import { applyThemeAttribute, themeScript } from './theme-script';

const OPTIONS = { cookie: 'theme', attribute: 'data-theme', values: ['light', 'dark'] };

describe('applyThemeAttribute', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.cookie = 'theme=; max-age=0';
  });

  it('ustawia dozwolona wartosc z ciasteczka', () => {
    document.cookie = 'theme=dark';
    applyThemeAttribute(OPTIONS);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignoruje nieznana wartosc', () => {
    document.cookie = 'theme=<script>';
    applyThemeAttribute(OPTIONS);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('themeScript', () => {
  it('wywoluje funkcje z opcjami jako JSON (bez wstawiania surowych napisow)', () => {
    const script = themeScript(OPTIONS);

    expect(script.startsWith('(function applyThemeAttribute(')).toBe(true);
    expect(script.endsWith(`)(${JSON.stringify(OPTIONS)})`)).toBe(true);
  });
});
