import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { activeStepIndex, AnalysisProgress, ANALYSIS_STEPS, SLOW_AFTER_SECONDS } from './analysis-progress';

const t = translator('analysis');

describe('AnalysisProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('kroki przelaczaja sie po czasie, ostatni trwa do konca', () => {
    expect(activeStepIndex(0)).toBe(0);
    expect(activeStepIndex(3)).toBe(1);
    expect(activeStepIndex(600)).toBe(ANALYSIS_STEPS.length - 1);
  });

  it('pokazuje biezacy krok, zrobione kroki i komunikat o wolnych zrodlach', () => {
    renderWithIntl(<AnalysisProgress />);

    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(t('progress.steps.parcel'));

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(t('progress.steps.soil'));
    expect(screen.getAllByText(`, ${t('progress.state.done')}`)).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(SLOW_AFTER_SECONDS * 1000);
    });
    expect(screen.getByText(t('progress.slow'))).toBeInTheDocument();
  });
});
