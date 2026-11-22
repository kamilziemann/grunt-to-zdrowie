// Raport wodny pola. Parametry analizy (dzialki, uprawa, dzien) sa w adresie, wiec raport otwiera sie z linku i
// przezywa odswiezenie; krotki link `?raport=r-…` otwiera raport z zapisu (bez liczenia). Analize liczy przegladarka (POST /api/analysis, do 30 s) - HTML nie zalezy od danych i idzie
// z cache brzegowego; raport z formularza jest juz w cache zapytan.
import { parseParcelSelection, serializeParcelSelection } from '@app/contracts';
import { routeCache } from '@app/start-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { analysisRequestFromSearch } from '@/features/analysis';
import {
  ReportMissing,
  ReportScreen,
  reportSearchSchema,
  StoredReportScreen,
  type ReportViewMode,
} from '@/features/report';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/raport')({
  validateSearch: reportSearchSchema,
  headers: routeCache('static'),
  head: ({ matches }) =>
    pageHead({
      title: headTranslator(matches, 'report')('metaTitle'),
      locale: headLocale(matches).locale,
      path: routes.report(),
      noindex: true,
    }),
  component: ReportPage,
});

function ReportPage() {
  const search = Route.useSearch();
  const t = useTranslations('report.header');
  const request = useMemo(
    () =>
      analysisRequestFromSearch(search, (kind, numbers) =>
        kind === 'part' && numbers.length > 0
          ? t('ownAreaPart', { numbers: numbers.join(', ') })
          : t('ownAreaDrawn'),
      ),
    [search, t],
  );
  const parcelIds = useMemo(() => parseParcelSelection(search.dzialki), [search.dzialki]);
  const dzialki = serializeParcelSelection(parcelIds);
  const changeHref = routes.analysis(dzialki, {
    obszar: search.obszar,
    rodzaj: search.obszar ? search.rodzaj : undefined,
    uprawa: search.uprawa,
    data: search.data,
  });
  const mapHref = routes.parcels(dzialki);
  const view = useMemo((): ReportViewMode => {
    const fieldSearch = search.raport
      ? { raport: search.raport }
      : {
          dzialki,
          obszar: search.obszar,
          rodzaj: search.obszar ? search.rodzaj : undefined,
          uprawa: search.uprawa,
          data: search.data,
        };

    return {
      detailed: search.widok === 'szczegoly',
      explicit: search.widok !== undefined,
      simpleHref: routes.report(fieldSearch),
      detailedHref: routes.report({ ...fieldSearch, widok: 'szczegoly' }),
    };
  }, [dzialki, search.raport, search.obszar, search.rodzaj, search.uprawa, search.data, search.widok]);
  const grasslandHref =
    search.uprawa === 'grassland'
      ? undefined
      : routes.report({
          dzialki,
          obszar: search.obszar,
          rodzaj: search.obszar ? search.rodzaj : undefined,
          uprawa: 'grassland',
          data: search.data,
        });

  if (search.raport) return <StoredReportScreen reportId={search.raport} view={view} />;

  if (!request) {
    return <ReportMissing changeHref={dzialki || search.obszar ? changeHref : null} mapHref={mapHref} />;
  }

  return (
    <ReportScreen
      request={request}
      changeHref={changeHref}
      mapHref={mapHref}
      grasslandHref={grasslandHref}
      view={view}
    />
  );
}
