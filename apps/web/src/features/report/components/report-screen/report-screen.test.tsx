import type { AppHref } from '@/lib/routes';
import type { AnalysisRequest } from '@app/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ANALYSIS_TIMEOUT_MS, analysisKeys } from '@/features/analysis';
import { IntlTestProvider, translator } from '@/test/render-intl';

import { SAMPLE_REPORT } from '../../fixtures/sample-report';
import { ReportScreen } from './report-screen';

const mocks = vi.hoisted(() => ({
  post: vi.fn<(args?: unknown, options?: { init?: { signal?: AbortSignal } }) => Promise<Response>>(),
}));

vi.mock('@/lib/api', () => ({ getApi: () => ({ analysis: { $post: mocks.post } }) }));

const tAnalysis = translator('analysis');
const DETAILS = {
  open: false,
  closedHref: '/raport' as AppHref,
  openHref: '/raport?widok=szczegoly' as AppHref,
};
const REQUEST: AnalysisRequest = {
  field: { parcelIds: ['141201_1.0001.6509'] },
  cropId: 'potato',
  date: '2025-07-01',
};

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <IntlTestProvider>
        <ReportScreen
          request={REQUEST}
          changeHref={'/analiza' as AppHref}
          mapHref={'/' as AppHref}
          details={DETAILS}
        />
      </IntlTestProvider>
    </QueryClientProvider>,
  );
}

describe('ReportScreen', () => {
  it('raport z cache (przejscie z formularza) pokazuje sie od razu', () => {
    const client = new QueryClient();

    client.setQueryData(analysisKeys.report(REQUEST), SAMPLE_REPORT);
    renderScreen(client);

    expect(screen.getByTestId('report')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('w trakcie liczenia kroki postepu, po bledzie komunikat z ponowieniem', async () => {
    mocks.post.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 502, code: 'upstream_failed', title: 'x', type: 'about:blank' }),
        {
          status: 502,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    );
    renderScreen(new QueryClient());

    expect(screen.getByTestId('analysis-progress')).toBeInTheDocument();
    expect(await screen.findByText(tAnalysis('error.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: tAnalysis('error.retry') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: tAnalysis('error.change') })).toHaveAttribute('href', '/analiza');
    // komunikat jezykiem rolnika, nie ogolne "nie udalo sie polaczyc z API"
    expect(screen.getByText(tAnalysis('error.messages.upstream_failed'))).toBeInTheDocument();
  });

  it('przekroczony czas: osobny komunikat i ponowienie', async () => {
    // limit czasu (AbortSignal.timeout) podmieniony na sygnal, ktory test przerywa sam
    const limit = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(limit.signal);

    // zapytanie konczy sie dopiero, gdy przegladarka przerwie je sygnalem
    mocks.post.mockImplementation(
      (_args?: unknown, options?: { init?: { signal?: AbortSignal } }) =>
        new Promise<Response>((_resolve, reject) => {
          options?.init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('timeout', 'TimeoutError')),
          );
        }),
    );
    renderScreen(new QueryClient());
    await vi.waitFor(() => expect(timeout).toHaveBeenCalledWith(ANALYSIS_TIMEOUT_MS));
    limit.abort();
    timeout.mockRestore();

    expect(await screen.findByText(tAnalysis('error.timeout'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: tAnalysis('error.retry') })).toBeInTheDocument();
  });
});
