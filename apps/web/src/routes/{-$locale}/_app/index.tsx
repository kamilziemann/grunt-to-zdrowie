// Strona glowna = wejscie: pole na numer dzialki, "Nie znam numeru - wskaze na mapie", przyklady wyniku i to, skad
// sa dane. HTML nie zalezy od danych ani sesji, wiec idzie z cache brzegowego. Stare linki z lista dzialek
// (`/?dzialki=...`, sprzed przeniesienia mapy) przekierowuja na `/mapa`. `/?q=...` to formularz wyslany, zanim strona
// ozyla w przegladarce (wolny internet) albo bez JavaScriptu: pelny numer prowadzi od razu na mape z ta dzialka, reszta
// uruchamia wyszukiwanie po wczytaniu strony.
import { PARCEL_ID_PATTERN, PARCEL_LIMITS, parcelSelectionSearchSchema } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { HomeScreen } from '@/features/parcels';
import { DEFAULT_LOCALE, localeFromParam, localizePath } from '@/lib/locale';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

const homeSearchSchema = parcelSelectionSearchSchema.extend({
  // numer z samych cyfr router oddaje jako liczbe
  q: z
    .union([z.string(), z.number().transform(String)])
    .pipe(z.string().trim().min(1).max(PARCEL_LIMITS.queryMax))
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/{-$locale}/_app/')({
  validateSearch: homeSearchSchema,
  beforeLoad: ({ search, params }) => {
    const locale = localeFromParam(params.locale) ?? DEFAULT_LOCALE;

    if (search.dzialki) {
      throw redirect({ href: localizePath(routes.parcels(search.dzialki), locale), statusCode: 301 });
    }

    if (search.q && PARCEL_ID_PATTERN.test(search.q)) {
      throw redirect({ href: localizePath(routes.parcels(search.q), locale), statusCode: 302 });
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
  component: HomePage,
});

function HomePage() {
  const { q } = Route.useSearch();

  return <HomeScreen initialQuery={q} />;
}
