// Pelny katalog obu jezykow naraz - tylko dla testow i narzedzi (import synchroniczny wszystkich plikow). Kod
// aplikacji laduje komunikaty per przestrzen (catalog.ts), zeby strony nie dostawaly calego katalogu w JS.
import type { Messages } from 'use-intl';

import type { AppLocale } from '@/lib/locale';

const files = import.meta.glob<Record<string, unknown>>('../../messages/*/*.json', {
  import: 'default',
  eager: true,
});

function catalogOf(locale: AppLocale): Messages {
  const prefix = `../../messages/${locale}/`;
  const entries = Object.entries(files)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, value]) => [path.slice(prefix.length, -'.json'.length), value]);

  return Object.fromEntries(entries) as Messages;
}

export const FULL_CATALOG: Record<AppLocale, Messages> = { pl: catalogOf('pl'), en: catalogOf('en') };
