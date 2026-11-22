// Analiza wodna pola (POST /api/analysis) jako zapytanie TanStack Query: wynik zalezy tylko od pola, uprawy i daty,
// wiec te same parametry z adresu strony (odswiezenie, link) trafiaja w ten sam wpis cache. Liczenie trwa do
// kilkudziesieciu sekund i odpytuje zewnetrzne zrodla - bez automatycznych ponowien (blad ma przycisk ponowienia).
// Zapisany raport (GET /api/reports/:id) sie nie zmienia - otwiera sie z linku bez liczenia i bez zrodel.
import type { AnalysisRequest, WaterReport } from '@app/contracts';
import { unwrap, unwrapOrNull } from '@app/rpc';
import { queryOptions } from '@tanstack/react-query';

import { getApi } from '@/lib/api';

/** Dluzej nie czekamy: analiza trwa zwykle 2-10 s, zrodla maja wlasne limity po stronie serwera. */
export const ANALYSIS_TIMEOUT_MS = 60_000;

/** Przegladarka przestala czekac na analize (`ANALYSIS_TIMEOUT_MS`) - ekran mowi o tym osobnym zdaniem. */
export class AnalysisTimeoutError extends Error {
  constructor() {
    super('analysis timed out');
    this.name = 'AnalysisTimeoutError';
  }
}

// raport dla tej samej daty i pola sie nie zmienia, a ponowne liczenie kosztuje - trzymamy go przez sesje strony
const STALE_MS = 30 * 60_000;

export const analysisKeys = {
  all: ['analysis'] as const,
  report: (request: AnalysisRequest) => ['analysis', 'report', request] as const,
  stored: (reportId: string) => ['analysis', 'stored', reportId] as const,
};

async function fetchReport(request: AnalysisRequest, signal: AbortSignal): Promise<WaterReport> {
  const timeout = AbortSignal.timeout(ANALYSIS_TIMEOUT_MS);

  try {
    return await unwrap<WaterReport>(
      getApi().analysis.$post({ json: request }, { init: { signal: AbortSignal.any([signal, timeout]) } }),
    );
  } catch (error) {
    if (timeout.aborted && !signal.aborted) throw new AnalysisTimeoutError();

    throw error;
  }
}

/** POST /analysis - raport wodny dla pola, uprawy i daty; po `ANALYSIS_TIMEOUT_MS` blad `AnalysisTimeoutError`. */
export const analysisReportQuery = (request: AnalysisRequest) =>
  queryOptions({
    queryKey: analysisKeys.report(request),
    queryFn: ({ signal }): Promise<WaterReport> => fetchReport(request, signal),
    staleTime: STALE_MS,
    gcTime: STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });

/** GET /reports/:id - zapisany raport (`meta.reportId`); null = nie ma takiego raportu (404). */
export const storedReportQuery = (reportId: string) =>
  queryOptions({
    queryKey: analysisKeys.stored(reportId),
    queryFn: (): Promise<WaterReport | null> =>
      unwrapOrNull<WaterReport>(getApi().reports[':id'].$get({ param: { id: reportId } })),
    staleTime: Infinity,
    gcTime: STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
