// Ladowanie komunikatow dla layoutow tras (loader `{-$locale}` i sekcji): tylko potrzebne przestrzenie, kazda jako
// osobny chunk (catalog.ts) - przegladarka pobiera je dopiero przy nawigacji, ktora ich wymaga.
import type { Messages } from 'use-intl';

import type { AppLocale } from '@/lib/locale';

import { loadNamespaces } from './catalog';
import { PUBLIC_NAMESPACES, SECTION_NAMESPACES, type ClientSection } from './client-messages';

/** Komunikaty zwyklych stron (bez przestrzeni sekcji). */
export function loadMessages(locale: AppLocale): Promise<Partial<Messages>> {
  return loadNamespaces(locale, PUBLIC_NAMESPACES);
}

/** Tylko przestrzenie sekcji (np. `dev`) - dokladane przez jej layout do komunikatow strony. */
export function loadSectionMessages(locale: AppLocale, section: ClientSection): Promise<Partial<Messages>> {
  return loadNamespaces(locale, SECTION_NAMESPACES[section]);
}
