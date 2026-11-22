// Krok "Czy to Twoja dzialka?": opis dzialki na ciemnym panelu, mapa obok i formularz analizy (uprawa + dzien). Te same identyfikatory w
// parametrze `dzialki` (albo wlasny obszar w `obszar` + `rodzaj`); `uprawa` i `data` wracaja z raportu ("zmien uprawe lub date"). Dane dzialek dociaga
// przegladarka, wiec HTML idzie z cache brzegowego. "Analizuj" prowadzi do `/raport` z parametrami w adresie.
import { parseParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, type ReactNode } from 'react';

import { AnalysisForm, analysisSearchSchema, fieldAreaFromSearch } from '@/features/analysis';
import { ParcelCheck } from '@/features/parcels';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/analiza')({
  validateSearch: analysisSearchSchema,
  staticData: { fullBleed: true },
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
  const { dzialki, obszar, rodzaj, uprawa, data } = Route.useSearch();
  const ids = useMemo(() => parseParcelSelection(dzialki), [dzialki]);
  // wlasny obszar (D3): uszkodzony zapis w linku = jak bez obszaru (analiza calych dzialek)
  const area = useMemo(() => {
    const decoded = fieldAreaFromSearch({ obszar });

    return decoded ? { geometry: decoded.geometry, kind: rodzaj ?? ('drawn' as const) } : null;
  }, [obszar, rodzaj]);
  const fieldSearch = useMemo(() => (area ? { obszar, rodzaj: area.kind } : undefined), [area, obszar]);

  const renderForm = useCallback(
    (summary: ReactNode) => (
      <AnalysisForm parcelIds={ids} area={fieldSearch} initialCropId={uprawa} initialDate={data}>
        {summary}
      </AnalysisForm>
    ),
    [ids, fieldSearch, uprawa, data],
  );

  return <ParcelCheck ids={ids} area={area} renderForm={renderForm} />;
}
