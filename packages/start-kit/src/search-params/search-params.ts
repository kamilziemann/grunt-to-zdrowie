// Search params jako zwykly query string. Domyslny serializer routera koduje JSON-em: `?q=2027` wraca jako
// `?q=%222027%22` (przekierowanie i drugi klucz w cache brzegu dla tej samej strony). Tu napisy zostaja napisami,
// a liczby i wartosci logiczne z parsera (`?page=2` -> 2) zamieniaja na tekst schematy `validateSearch`.
import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router';

const keepText = (value: string): string => value;

/** `parseSearch` routera: bez JSON.parse wartosci. */
export const parsePlainSearch = parseSearchWith(keepText);

/** `stringifySearch` routera: napisy bez cudzyslowow, obiekty (rzadkie) jako JSON. */
export const stringifyPlainSearch = stringifySearchWith(JSON.stringify);
