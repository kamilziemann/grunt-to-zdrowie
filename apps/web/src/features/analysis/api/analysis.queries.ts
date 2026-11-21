// Analiza wodna pola (POST /api/analysis) jako zapytanie TanStack Query: wynik zalezy tylko od pola, uprawy i daty,
// wiec te same parametry z adresu strony (odswiezenie, link) trafiaja w ten sam wpis cache. Liczenie trwa do
// kilkudziesieciu sekund i odpytuje zewnetrzne zrodla - bez automatycznych ponowien (blad ma przycisk ponowienia).
import type { AnalysisRequest, WaterReport } from '@app/contracts';
import { unwrap } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';

// raport dla tej samej daty i pola sie nie zmienia, a ponowne liczenie kosztuje - trzymamy go przez sesje strony
const STALE_MS = 30 * 60_000;

export const analysisKeys = {
  all: ['analysis'] as const,
  report: (request: AnalysisRequest) => ['analysis', 'report', request] as const,
};

/** POST /analysis - raport wodny dla pola, uprawy i daty. */
export const analysisReportQuery = (request: AnalysisRequest) =>
  queryOptions({
    queryKey: analysisKeys.report(request),
    queryFn: ({ signal }): Promise<WaterReport> =>
      unwrap<WaterReport>(getApi().analysis.$post({ json: request }, { init: { signal } })),
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
