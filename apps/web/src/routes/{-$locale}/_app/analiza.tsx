// Podsumowanie dzialek wybranych do analizy wodnej (krok po mapie). Te same identyfikatory w parametrze `dzialki`;
// dane dociaga przegladarka, wiec HTML idzie z cache brzegowego. Wybor uprawy i sama analiza to nastepny etap.
import { parcelSelectionSearchSchema, parseParcelSelection, serializeParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { AnalysisSummary } from '@/features/parcels';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/analiza')({
  validateSearch: parcelSelectionSearchSchema,
  headers: routeCache('static'),
  head: ({ matches }) =>
    pageHead({
      title: headTranslator(matches, 'parcels')('summary.metaTitle'),
      locale: headLocale(matches).locale,
      path: routes.analysis(),
      noindex: true,
    }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { dzialki } = Route.useSearch();
  const ids = useMemo(() => parseParcelSelection(dzialki), [dzialki]);

  return <AnalysisSummary ids={ids} backHref={routes.parcels(serializeParcelSelection(ids))} />;
}
