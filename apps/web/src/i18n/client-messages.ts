// Ktore przestrzenie komunikatow trafiaja do strony (stan routera w HTML i chunki JS). Zwykle strony nie potrzebuja
// przestrzeni sekcji deweloperskiej; doklada je jej layout (trasa `{-$locale}/_app/_dev`). Ze komponenty spoza sekcji
// nie siegaja po te przestrzenie, pilnuje client-messages.test.ts. Nowa sekcja (np. panel admina) = wpis tutaj.
import { NAMESPACES, type Namespace } from './namespaces';

export const SECTION_NAMESPACES = {
  dev: ['design'],
} as const satisfies Record<string, readonly Namespace[]>;

export type ClientSection = keyof typeof SECTION_NAMESPACES;

const SECTION_ONLY: ReadonlySet<string> = new Set(Object.values(SECTION_NAMESPACES).flat());

/** Przestrzenie stron publicznych (layout jezyka) - wszystkie poza wydzielonymi sekcjami. */
export const PUBLIC_NAMESPACES: readonly Namespace[] = NAMESPACES.filter(
  (namespace) => !SECTION_ONLY.has(namespace),
);
