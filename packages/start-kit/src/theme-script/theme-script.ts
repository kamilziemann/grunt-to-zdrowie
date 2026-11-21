// Skrypt motywu w <head>, wykonywany przed pierwszym malowaniem: czyta ciasteczko i ustawia atrybut na <html>.
// Dzieki temu HTML z serwera nie zalezy od ciasteczek (moze byc wspolny w cache'u CDN), a nie ma migniecia motywu.
// Logika to zwykla funkcja (testowalna bez eval); skrypt inline to jej zrodlo wywolane z opcjami jako JSON.
export interface ThemeScriptOptions {
  cookie: string;
  attribute: string;
  /** dozwolone wartosci atrybutu (inne ciasteczko = brak atrybutu = motyw systemu) */
  values: readonly string[];
}

/** Atrybut motywu z ciasteczka. Samowystarczalna (bez domkniec) - jej `toString()` trafia do <head>. */
export function applyThemeAttribute(options: ThemeScriptOptions): void {
  try {
    const prefix = `${options.cookie}=`;
    const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    const value = entry ? decodeURIComponent(entry.slice(prefix.length)) : null;

    if (value && options.values.includes(value))
      document.documentElement.setAttribute(options.attribute, value);
  } catch {
    // zablokowane ciasteczka albo zly zapis: zostaje motyw systemu
  }
}

export function themeScript(options: ThemeScriptOptions): string {
  return `(${applyThemeAttribute.toString()})(${JSON.stringify(options)})`;
}
