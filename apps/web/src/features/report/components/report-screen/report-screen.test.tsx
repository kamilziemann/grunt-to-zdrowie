import type { AppHref } from '@/lib/routes';
import type { AnalysisRequest } from '@app/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { analysisKeys } from '@/features/analysis';
import { IntlTestProvider, translator } from '@/test/render-intl';

import { SAMPLE_REPORT } from '../../fixtures/sample-report';
import { ReportScreen } from './report-screen';

const mocks = vi.hoisted(() => ({ post: vi.fn<() => Promise<Response>>() }));

vi.mock('@/lib/api', () => ({ getApi: () => ({ analysis: { $post: mocks.post } }) }));

const tAnalysis = translator('analysis');
const REQUEST: AnalysisRequest = {
  field: { parcelIds: ['141201_1.0001.6509'] },
  cropId: 'potato',
  date: '2025-07-01',
};

function renderScreen(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <IntlTestProvider>
        <ReportScreen request={REQUEST} changeHref={'/analiza' as AppHref} mapHref={'/' as AppHref} />
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
  });
});
