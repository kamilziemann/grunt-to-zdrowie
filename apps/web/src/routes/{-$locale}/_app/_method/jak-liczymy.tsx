// "Jak liczymy" (`/jak-liczymy`): statyczna strona metodyki z cache brzegowym, w pl i en. Tresc w `messages/*/method`.
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';

import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

import { MethodPage } from './-method/method-page';

export const Route = createFileRoute('/{-$locale}/_app/_method/jak-liczymy')({
  headers: routeCache('static'),
  head: ({ matches }) => {
    const t = headTranslator(matches, 'method');

    return pageHead({
      title: t('metaTitle'),
      description: t('metaDescription'),
      locale: headLocale(matches).locale,
      path: routes.method(),
    });
  },
  component: MethodPage,
});
