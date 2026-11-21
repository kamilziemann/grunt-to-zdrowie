import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { ANALYSIS_SOURCES, AnalysisProgress, SLOW_AFTER_SECONDS } from './analysis-progress';

const t = translator('analysis');

describe('AnalysisProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mowi, co pobiera rownoczesnie - bez krokow odhaczanych zegarem i bez procentow', () => {
    renderWithIntl(<AnalysisProgress />);

    const list = screen.getByRole('list', { name: t('progress.listLabel') });

    expect(list.querySelectorAll('li')).toHaveLength(ANALYSIS_SOURCES.length);
    expect(list).toHaveTextContent(t('progress.sources.weather'));
    expect(screen.getByTestId('analysis-progress').textContent).not.toMatch(/%/);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole('listitem', { current: 'step' })).not.toBeInTheDocument();
  });

  it('po kilkunastu sekundach mowi wprost, ze zrodla odpowiadaja wolniej', () => {
    renderWithIntl(<AnalysisProgress />);

    act(() => {
      vi.advanceTimersByTime(SLOW_AFTER_SECONDS * 1000);
    });
    expect(screen.getByText(t('progress.slow', { seconds: SLOW_AFTER_SECONDS }))).toBeInTheDocument();
  });
});
