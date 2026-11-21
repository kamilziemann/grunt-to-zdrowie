import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
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

  it('domyslnie szkic: podpis dzialki, fakt z linia odniesienia, legenda; zdjecie dopiero po kliknieciu', () => {
    renderWithIntl(
      <QueryClientProvider client={clientWithTiles()}>
        <FieldMap field={FIELD} ditchInFieldM={null} />
      </QueryClientProvider>,
    );

    const sketch = screen.getByTestId('field-sketch');

    expect(sketch).toHaveTextContent('Działka 6509');
    expect(sketch).toHaveTextContent('100 m');
    expect(screen.getByTestId('field-sketch-fact')).toHaveTextContent(/^Rów na skraju pola, \d+ m$/);
    expect(screen.getByTestId('field-sketch-label').textContent).toMatch(
      /^Szkic: Działka 6509 i woda w promieniu 250 m od pola\. Rów na skraju pola/,
    );
    expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Granica pola');
    expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Rowy melioracyjne');
    expect(screen.getByTestId('field-map')).toHaveTextContent('Szkic w skali, północ u góry');
    expect(screen.queryByTestId('field-map-canvas')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż na zdjęciu lotniczym' }));

    expect(screen.getByRole('button', { name: 'Wróć do szkicu' })).toBeInTheDocument();
  });

  it('dlugosc rowu w polu z raportu na szkicu', () => {
    renderWithIntl(
      <QueryClientProvider client={clientWithTiles()}>
        <FieldMap field={FIELD} ditchInFieldM={428} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('field-sketch-fact')).toHaveTextContent('Rów na skraju pola, 428 m');
  });

  it('bez kafli hydrografii: sam obrys pola, bez faktu', () => {
    renderWithIntl(
      <QueryClientProvider client={new QueryClient()}>
        <FieldMap field={FIELD} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('field-sketch-field')).toBeInTheDocument();
    expect(screen.queryByTestId('field-sketch-fact')).toBeNull();
    expect(screen.getByTestId('field-map')).toHaveTextContent('Wczytuję rowy i cieki');
  });
});
