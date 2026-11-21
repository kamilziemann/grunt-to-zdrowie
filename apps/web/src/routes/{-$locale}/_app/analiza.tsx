// Krok po mapie: podsumowanie wybranych dzialek i formularz analizy (uprawa + dzien). Te same identyfikatory w
// parametrze `dzialki`; `uprawa` i `data` wracaja z raportu ("zmien uprawe lub date"). Dane dzialek dociaga
// przegladarka, wiec HTML idzie z cache brzegowego. "Analizuj" prowadzi do `/raport` z parametrami w adresie.
import { parseParcelSelection, serializeParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { AnalysisForm, analysisSearchSchema } from '@/features/analysis';
import { AnalysisSummary } from '@/features/parcels';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/analiza')({
  validateSearch: analysisSearchSchema,
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
  const { dzialki, uprawa, data } = Route.useSearch();
  const ids = useMemo(() => parseParcelSelection(dzialki), [dzialki]);
  const backHref = routes.parcels(serializeParcelSelection(ids));

  if (ids.length === 0) return <AnalysisSummary ids={ids} backHref={backHref} />;

  return (
    <AnalysisForm parcelIds={ids} initialCropId={uprawa} initialDate={data}>
      <AnalysisSummary ids={ids} backHref={backHref} />
    </AnalysisForm>
  );
}
