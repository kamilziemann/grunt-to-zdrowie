// Jezyk jest w adresie (`/` = polski, `/en/...` = angielski) - ten sam adres strony w angielskim interfejsie.
// Testy angielskiej wersji biegna tylko, gdy angielski jest wlaczony (src/lib/locale ENABLED_LOCALES).
import { isLocaleEnabled } from '../../src/lib/locale/locale';

export const EN_ENABLED = isLocaleEnabled('en');

export const EN_DISABLED = 'angielski wylaczony (src/lib/locale ENABLED_LOCALES)';

export function englishPath(path: string): string {
  return path === '/' ? '/en' : `/en${path}`;
}
