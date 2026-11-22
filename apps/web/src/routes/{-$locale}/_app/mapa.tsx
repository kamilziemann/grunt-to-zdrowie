// Ekran mapy: wskazanie dzialki kliknieciem ("Nie znam numeru"), lista "moje dzialki" (kilka dzialek jako jedno pole)
// i wlasne pole (rysowanie, podzial dzialki). Lista zyje w parametrze `dzialki`, widok z adresu wybranego na stronie
// glownej w `widok`, tryb rysowania w `rysuj`. Dzialki dociaga przegladarka, wiec HTML idzie z cache brzegowego.
import { parseParcelSelection, serializeParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import { MAP_DRAW_PARAM, mapSearchSchema, ParcelsScreen, parseMapView } from '@/features/parcels';
import { routes, type FieldSearch } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/mapa')({
  validateSearch: mapSearchSchema,
  staticData: { fullBleed: true },
  headers: routeCache('static'),
  head: ({ matches }) => {
    const t = headTranslator(matches, 'parcels');

    return pageHead({
      title: t('metaTitle'),
      description: t('metaDescription'),
      locale: headLocale(matches).locale,
      path: routes.map(),
    });
  },
  component: MapPage,
});

const analysisHref = (ids: readonly string[], area?: FieldSearch) =>
  routes.analysis(serializeParcelSelection(ids), area);

function MapPage() {
  const { dzialki, widok, rysuj } = Route.useSearch();
  const navigate = Route.useNavigate();
  const ids = useMemo(() => parseParcelSelection(dzialki), [dzialki]);
  const view = useMemo(() => parseMapView(widok), [widok]);
  const setIds = useCallback(
    (next: string[]) => {
      // widok z adresu sluzy tylko pierwszemu dojazdowi - po zmianie listy mapa jedzie do dzialek
      void navigate({ search: { dzialki: serializeParcelSelection(next), rysuj }, replace: true });
    },
    [navigate, rysuj],
  );

  return (
    <ParcelsScreen
      ids={ids}
      onIdsChange={setIds}
      analysisHref={analysisHref}
      initialView={view}
      initialDraw={rysuj ? MAP_DRAW_PARAM[rysuj] : null}
    />
  );
}
