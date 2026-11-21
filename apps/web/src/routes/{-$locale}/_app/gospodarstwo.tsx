// Gospodarstwo (I2): kilka dzialek analizowanych osobno, z kolejnoscia "gdzie dzialac najpierw". Parametry jak w
// raporcie (`dzialki`, `uprawa`, `data`), wiec widok otwiera sie z linku; analizy liczy przegladarka po dwie naraz.
import { parseParcelSelection, serializeParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import { analysisSearchSchema } from '@/features/analysis';
import { FarmScreen, ReportMissing } from '@/features/report';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/gospodarstwo')({
  validateSearch: analysisSearchSchema,
  headers: routeCache('static'),
  head: ({ matches }) =>
    pageHead({
      title: headTranslator(matches, 'report')('farm.metaTitle'),
      locale: headLocale(matches).locale,
      path: routes.farm(),
      noindex: true,
    }),
  component: FarmPage,
});

function FarmPage() {
  const { dzialki, uprawa, data } = Route.useSearch();
  const parcelIds = useMemo(() => parseParcelSelection(dzialki), [dzialki]);
  const serialized = serializeParcelSelection(parcelIds);
  const changeHref = routes.analysis(serialized, { uprawa, data });
  const mapHref = routes.parcels(serialized);
  const reportHref = useCallback(
    (id: string) => routes.report({ dzialki: id, uprawa, data }),
    [uprawa, data],
  );

  if (parcelIds.length < 2 || !uprawa || !data) {
    return <ReportMissing changeHref={serialized ? changeHref : null} mapHref={mapHref} />;
  }

  return (
    <FarmScreen
      parcelIds={parcelIds}
      cropId={uprawa}
      date={data}
      reportHref={reportHref}
      changeHref={changeHref}
      mapHref={mapHref}
    />
  );
}
