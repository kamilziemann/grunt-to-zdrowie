import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HYDRO_TILES } from '@/features/parcels';
import { hydroTiles } from '@/lib/hydro-map';
import { renderWithIntl } from '@/test/render-intl';

import { LOW_CONFIDENCE_REPORT } from '../../fixtures/low-confidence-report';
import { FieldMap } from './field-map';

const FIELD = LOW_CONFIDENCE_REPORT.field;
const EMPTY = { features: [], truncated: false, importedAt: null };

/** Kafle okolicy pola w cache zapytan (bez sieci): z fixture albo puste. */
function clientWithTiles(): QueryClient {
  const client = new QueryClient();
  const [west, south, east, north] = FIELD.bbox;

  for (const tile of hydroTiles(west - 0.01, south - 0.01, east + 0.01, north + 0.01)) {
    client.setQueryData(['parcels', 'hydro', tile.x, tile.y], HYDRO_TILES[`${tile.x}/${tile.y}`] ?? EMPTY);
  }

  return client;
}

describe('FieldMap', () => {
  it('podpis: najblizszy row przez pole, brak cieku w 500 m, zrodla z data danych', () => {
    renderWithIntl(
      <QueryClientProvider client={clientWithTiles()}>
        <FieldMap field={FIELD} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('field-map')).toHaveAttribute('data-hydro', 'ready');
    expect(screen.getByTestId('field-map-nearest')).toHaveTextContent(
      'Najbliższy rów melioracyjny: przy samym polu albo przez pole.',
    );
    expect(screen.getByTestId('field-map-nearest')).toHaveTextContent(
      'Brak rzek, strumieni i kanałów w promieniu 500 m.',
    );
    expect(screen.getByTestId('field-map')).toHaveTextContent('BDOT10k, GUGiK (dane z 21 lis 2026)');
  });
});
