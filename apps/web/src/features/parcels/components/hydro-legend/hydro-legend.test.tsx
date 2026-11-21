import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { HydroLegend } from './hydro-legend';

const READY = { state: 'ready', importedAt: '2026-11-21T20:40:36.816Z', truncated: true } as const;
const ZOOM = { state: 'zoom', importedAt: null, truncated: false } as const;
const UNAVAILABLE = { state: 'unavailable', importedAt: null, truncated: false } as const;

describe('HydroLegend', () => {
  it('pieć rodzajów obiektów, źródło z datą danych i dopisek o przycięciu', () => {
    renderWithIntl(<HydroLegend status={READY} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/Źródło: BDOT10k, GUGiK · dane z 21 lis 2026/)).toHaveTextContent(
      'przybliż mapę',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stan warstwy widoczny w zwiniętej legendzie: przybliż mapę albo chwilowo niedostępna', () => {
    const { rerender } = renderWithIntl(<HydroLegend status={ZOOM} />);

    expect(screen.getByRole('status')).toHaveTextContent('Przybliż mapę, żeby zobaczyć rowy i cieki.');
    expect(screen.getByText('Źródło: BDOT10k, GUGiK')).toBeInTheDocument();
    rerender(<HydroLegend status={UNAVAILABLE} />);
    expect(screen.getByRole('status')).toHaveTextContent('chwilowo niedostępna');
  });
});
