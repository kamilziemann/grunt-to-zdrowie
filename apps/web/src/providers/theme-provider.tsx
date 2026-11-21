import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { nextTheme, parseTheme, readThemeCookie, themeAttribute, themeCookie, type Theme } from '@/lib/theme';

interface ThemeApi {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

// Motyw zyje w ciasteczku (zrodlo prawdy dla skryptu w <head>); ten magazyn powiadamia komponenty o zmianie.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

const readTheme = (): Theme => parseTheme(readThemeCookie(document.cookie));

const serverTheme = (): Theme => 'system';

/**
 * Stan motywu. HTML z serwera nie zna ciasteczek (jest wspolny w cache'u CDN): atrybut na <html> ustawia skrypt w
 * <head> przed pierwszym malowaniem (lib/theme THEME_SCRIPT). `useSyncExternalStore` hydratuje z wartoscia serwera
 * ('system'), a potem czyta ciasteczko - bez rozjazdu hydracji i bez setState w efekcie. Zmiana zapisuje ciasteczko
 * i atrybut.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const setTheme = useCallback((next: Theme) => {
    const attribute = themeAttribute(next);
    const root = document.documentElement;

    if (attribute) root.dataset.theme = attribute;
    else root.removeAttribute('data-theme');

    document.cookie = themeCookie(next);

    for (const listener of listeners) listener();
  }, []);
  const cycleTheme = useCallback(() => setTheme(nextTheme(theme)), [setTheme, theme]);
  const value = useMemo<ThemeApi>(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);

  if (!ctx) throw new Error('useTheme wymaga <ThemeProvider> w drzewie komponentow');

  return ctx;
}
