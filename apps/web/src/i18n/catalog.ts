// Ladowanie komunikatow per przestrzen: `import.meta.glob` daje leniwy import kazdego pliku
// `messages/<jezyk>/<przestrzen>.json`, wiec do przegladarki trafiaja tylko chunki przestrzeni danej strony.
import type { Messages } from 'use-intl';

import type { AppLocale } from '@/lib/locale';

import type { Namespace } from './namespaces';

const loaders = import.meta.glob<unknown>('../../messages/*/*.json', { import: 'default' });

/** Wybrane przestrzenie jezyka jako jeden obiekt komunikatow. */
export async function loadNamespaces(
  locale: AppLocale,
  namespaces: readonly Namespace[],
): Promise<Partial<Messages>> {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => {
      const load = loaders[`../../messages/${locale}/${namespace}.json`];

      if (!load) throw new Error(`Brak komunikatow ${locale}/${namespace}`);

      return [namespace, await load()] as const;
    }),
  );

  return Object.fromEntries(entries);
}
