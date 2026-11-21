// Katalog systemu designu dla zespolu i testow wizualnych. Tylko development (pilnuje layout `_dev`); bez
// `headers`, wiec odpowiedz jest `private, no-store`. Tresc katalogu w `-design/` (pliki z `-` router pomija).
import { createFileRoute } from '@tanstack/react-router';

import { headTranslator, pageHead } from '@/lib/seo';

import { DesignCatalog } from './-design/design-catalog';

export const Route = createFileRoute('/{-$locale}/_app/_dev/design')({
  head: ({ matches }) => pageHead({ title: headTranslator(matches, 'design')('metaTitle'), noindex: true }),
  component: DesignCatalog,
});
