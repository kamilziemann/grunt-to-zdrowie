// Przestrzenie komunikatow: kazda to osobny plik `messages/<jezyk>/<przestrzen>.json` i osobny chunk JS - strona
// laduje tylko przestrzenie, ktorych uzywa (sekcja deweloperska doklada swoje w layoucie `_dev`).
// Lista musi zgadzac sie z plikami w messages/pl (pilnuje messages.test.ts).
export const NAMESPACES = [
  'analysis',
  'auth',
  'common',
  'design',
  'errors',
  'method',
  'nav',
  'parcels',
  'problems',
  'report',
] as const;

export type Namespace = (typeof NAMESPACES)[number];
