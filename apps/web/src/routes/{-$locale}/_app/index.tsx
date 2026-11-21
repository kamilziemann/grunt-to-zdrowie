// Strona glowna = narzedzie: mapa i wyszukiwanie dzialek (pierwszy krok analizy wodnej). Lista "moje dzialki" zyje
// w parametrze `dzialki`. Dzialki dociaga przegladarka (mapa i tak powstaje dopiero tam, a SSR nie czeka na ULDK),
// wiec HTML nie zalezy od danych ani sesji i idzie z cache brzegowego.
import { parcelSelectionSearchSchema, parseParcelSelection, serializeParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import { ParcelsScreen } from '@/features/parcels';
import { routes, type FieldSearch } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/')({
  validateSearch: parcelSelectionSearchSchema,
  staticData: { fullBleed: true },
  headers: routeCache('static'),
  head: ({ matches }) => {
    const t = headTranslator(matches, 'parcels');

    return pageHead({
      title: t('metaTitle'),
      description: t('metaDescription'),
      locale: headLocale(matches).locale,
      path: routes.home(),
    });
  },
  component: ParcelsPage,
});

const analysisHref = (ids: readonly string[], area?: FieldSearch) =>
  routes.analysis(serializeParcelSelection(ids), area);

function ParcelsPage() {
  const { dzialki } = Route.useSearch();
  const navigate = Route.useNavigate();
  const ids = useMemo(() => parseParcelSelection(dzialki), [dzialki]);
  const setIds = useCallback(
    (next: string[]) => {
      void navigate({ search: { dzialki: serializeParcelSelection(next) }, replace: true });
    },
    [navigate],
  );

  return <ParcelsScreen ids={ids} onIdsChange={setIds} analysisHref={analysisHref} />;
}
