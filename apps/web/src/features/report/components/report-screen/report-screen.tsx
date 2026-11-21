import type { AnalysisRequest } from '@app/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { AnalysisFailure, AnalysisProgress, analysisReportQuery } from '@/features/analysis';
import { toProblem } from '@/lib/problems';
import type { AppHref } from '@/lib/routes';

import { ReportView } from '../report-view';

export interface ReportScreenProps {
  request: AnalysisRequest;
  changeHref: AppHref;
  mapHref: AppHref;
  /** ten sam raport z uprawa "laka lub pastwisko" */
  grasslandHref?: AppHref;
}

/**
 * Ekran raportu dla parametrow z adresu: analiza liczy sie w przegladarce (SSR nie czeka do 30 s na zrodla), w tym
 * czasie kroki postepu; blad ma ponowienie i powrot do formularza. Raport policzony z formularza jest juz w cache.
 */
export function ReportScreen({ request, changeHref, mapHref, grasslandHref }: ReportScreenProps) {
  const t = useTranslations('report');
  const query = useQuery(analysisReportQuery(request));
  const { refetch } = query;
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
      />
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-3xl leading-tight font-bold text-primary">{t('title')}</h1>
      {query.isError && !query.isFetching ? (
        <AnalysisFailure problem={toProblem(query.error)} onRetry={retry} changeHref={changeHref} />
      ) : (
        <AnalysisProgress />
      )}
    </div>
  );
}
