// Strona glowna = wejscie: pole na numer dzialki, "Nie znam numeru - wskaze na mapie", przyklady wyniku i to, skad
// sa dane. HTML nie zalezy od danych ani sesji, wiec idzie z cache brzegowego. Stare linki z lista dzialek
// (`/?dzialki=...`, sprzed przeniesienia mapy) przekierowuja na `/mapa`.
import { parcelSelectionSearchSchema } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { HomeScreen } from '@/features/parcels';
import { DEFAULT_LOCALE, localeFromParam, localizePath } from '@/lib/locale';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/')({
  validateSearch: parcelSelectionSearchSchema,
  beforeLoad: ({ search, params }) => {
    if (search.dzialki) {
      throw redirect({
        href: localizePath(routes.parcels(search.dzialki), localeFromParam(params.locale) ?? DEFAULT_LOCALE),
        statusCode: 301,
      });
    }
  },
  staticData: { wide: true },
  headers: routeCache('static'),
  head: ({ matches }) => {
    const t = headTranslator(matches, 'parcels');

    return pageHead({
      title: t('home.metaTitle'),
      description: t('home.metaDescription'),
      locale: headLocale(matches).locale,
      path: routes.home(),
    });
  },
  component: HomeScreen,
});
