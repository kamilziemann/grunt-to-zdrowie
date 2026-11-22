// Tryb obrazu w karcie "Twoje pole": szkic (domyslny), zdjecie lotnicze albo jeden z obrazow z satelity. Wybor jest
// wspolny dla wszystkich raportow w tej przegladarce (ten sam klucz co dawny przelacznik "Szkic / Zdjecie lotnicze").
import { useSyncExternalStore } from 'react';

export const FIELD_MODES = ['sketch', 'aerial', 'condition', 'moisture'] as const;

export type FieldMode = (typeof FIELD_MODES)[number];

const STORAGE_KEY = 'gtz-field-map-mode';

/**
 * Maly magazyn dla `useSyncExternalStore`: na serwerze i przy hydratacji zawsze szkic (ten sam HTML dla kazdego),
 * potem wartosc z `localStorage`; bez dostepu do pamieci wybor zyje do przeladowania strony.
 */
let memory: FieldMode | null = null;
const listeners = new Set<() => void>();

function isFieldMode(value: string | null): value is FieldMode {
  return FIELD_MODES.some((mode) => mode === value);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function read(): FieldMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);

    if (isFieldMode(value)) return value;
  } catch {
    // tryb prywatny albo zablokowana pamiec - zostaje wybor z tej wizyty
  }

  return memory ?? 'sketch';
}

function serverMode(): FieldMode {
  return 'sketch';
}

export function chooseFieldMode(mode: FieldMode) {
  memory = mode;

  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // jak wyzej - przelacznik dziala dalej, tylko bez zapamietania
  }

  for (const listener of listeners) listener();
}

export function useFieldMode(): FieldMode {
  return useSyncExternalStore(subscribe, read, serverMode);
}
