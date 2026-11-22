import type { AnalysisRequest } from '@app/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useTranslations } from 'use-intl';

import {
  AnalysisFailure,
  AnalysisProgress,
  analysisReportQuery,
  AnalysisTimeoutError,
  storedReportQuery,
} from '@/features/analysis';
import { toProblem } from '@/lib/problems';
import type { AppHref } from '@/lib/routes';

import { ReportView } from '../report-view';
import type { ReportViewMode } from '../view-switch';

export interface ReportScreenProps {
  request: AnalysisRequest;
  changeHref: AppHref;
  mapHref: AppHref;
  /** ten sam raport z uprawa "laka lub pastwisko" */
  grasslandHref?: AppHref;
  /** widok prosty albo szczegolowy (parametr `widok` w adresie) */
  view: ReportViewMode;
}

/**
 * Ekran raportu dla parametrow z adresu: analiza liczy sie w przegladarce (SSR nie czeka do 30 s na zrodla), w tym
 * czasie kroki postepu; blad ma ponowienie i powrot do formularza. Raport policzony z formularza jest juz w cache.
 */
export function ReportScreen({ request, changeHref, mapHref, grasslandHref, view }: ReportScreenProps) {
  const t = useTranslations('report');
  const query = useQuery(analysisReportQuery(request));
  const { refetch } = query;
  const client = useQueryClient();
  const report = query.data;

  // krotki link do tego raportu (`?raport=`) otworzy sie w tej sesji bez pytania serwera
  useEffect(() => {
    if (report) client.setQueryData(storedReportQuery(report.meta.reportId).queryKey, report);
  }, [client, report]);
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (query.data) {
    return (
      <ReportView
        report={query.data}
        changeHref={changeHref}
        mapHref={mapHref}
        grasslandHref={grasslandHref}
        view={view}
      />
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-3xl leading-tight font-bold text-primary">{t('title')}</h1>
      {query.isError && !query.isFetching ? (
        <AnalysisFailure
          problem={toProblem(query.error)}
          onRetry={retry}
          changeHref={changeHref}
          timedOut={query.error instanceof AnalysisTimeoutError}
        />
      ) : (
        <AnalysisProgress />
      )}
    </div>
  );
}
