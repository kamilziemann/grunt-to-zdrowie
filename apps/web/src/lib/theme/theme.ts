// Preferencja motywu: ciasteczko `theme`; atrybut data-theme na <html> ustawia skrypt w <head> przed pierwszym
// malowaniem (HTML z serwera jest wspolny w cache'u CDN i nie zalezy od ciasteczek). Brak ciasteczka albo `system` =
// ustawienie systemu (prefers-color-scheme), bez atrybutu.
import { themeScript } from '@app/start-kit';
export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = 'theme';

/** Rok w sekundach: preferencja ma przetrwac sesje. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Wartosc z ciasteczka -> Theme (nieznana albo brak = `system`). */
export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? 'system';
}

/** Wartosc atrybutu `data-theme`: tylko wymuszony motyw, `system` = brak atrybutu. */
export function themeAttribute(theme: Theme): 'light' | 'dark' | undefined {
  return theme === 'system' ? undefined : theme;
}

/** Nastepny motyw przy kliknieciu przelacznika: system -> jasny -> ciemny -> system. */
export function nextTheme(theme: Theme): Theme {
  const index = THEMES.indexOf(theme);

  return THEMES[(index + 1) % THEMES.length] ?? 'system';
}

/** Tekst ciasteczka do `document.cookie` (przegladarka). */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

/** Wartosc ciasteczka `theme` z tekstu `document.cookie`. */
export function readThemeCookie(cookieHeader: string): string | undefined {
  return new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`).exec(cookieHeader)?.[1];
}

/** Skrypt do <head>: atrybut wymuszonego motywu z ciasteczka przed pierwszym malowaniem (bez migniecia). */
export const THEME_SCRIPT = themeScript({
  cookie: THEME_COOKIE,
  attribute: 'data-theme',
  values: ['light', 'dark'],
});
