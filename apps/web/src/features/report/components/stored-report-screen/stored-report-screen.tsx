import { useQuery } from '@tanstack/react-query';
import { FileX, LoaderCircle } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { AnalysisFailure, isReportId, storedReportQuery } from '@/features/analysis';
import { Link } from '@/lib/navigation';
import { toProblem } from '@/lib/problems';
import { routes } from '@/lib/routes';

import { reportSearch } from '../../utils/report-data';
import { ReportView } from '../report-view';
import type { ReportViewMode } from '../view-switch';

export interface StoredReportScreenProps {
  /** identyfikator z adresu (`raport=`) */
  reportId: string;
  view: ReportViewMode;
}

/**
 * Raport z krotkiego linku (`/raport?raport=r-…`): zapisany raport z GET /api/reports/:id, bez liczenia i bez
 * pytania zrodel. Nieznany albo zly identyfikator - czytelny komunikat i wyjscie do mapy.
 */
export function StoredReportScreen({ reportId, view }: StoredReportScreenProps) {
  const t = useTranslations('report');
  const valid = isReportId(reportId);
  const query = useQuery({ ...storedReportQuery(reportId), enabled: valid });
  const { refetch } = query;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
  const report = query.data;

  if (report) {
    const search = reportSearch(report);
    const recomputeHref = routes.report(search);

    return (
      <ReportView
        report={report}
        changeHref={routes.analysis(search.dzialki, search)}
        mapHref={routes.parcels(search.dzialki)}
        grasslandHref={
          search.uprawa === 'grassland' ? undefined : routes.report({ ...search, uprawa: 'grassland' })
        }
        recomputeHref={recomputeHref}
        view={view}
      />
    );
  }

  if (!valid || report === null) return <StoredReportMissing />;

  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-3xl leading-tight font-bold text-primary">{t('title')}</h1>
      {query.isError && !query.isFetching ? (
        <AnalysisFailure problem={toProblem(query.error)} onRetry={retry} changeHref={routes.parcels()} />
      ) : (
        <output className="flex items-center gap-2 text-base text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
          {t('stored.loading')}
        </output>
      )}
    </div>
  );
}

/** Link do raportu, ktorego nie ma (zly albo stary identyfikator). */
function StoredReportMissing() {
  const t = useTranslations('report.stored.missing');

  return (
    <EmptyState titleAs="h1" icon={FileX} title={t('title')} description={t('description')}>
      <Button asChild size="xl">
        <Link href={routes.parcels()}>{t('map')}</Link>
      </Button>
    </EmptyState>
  );
}
