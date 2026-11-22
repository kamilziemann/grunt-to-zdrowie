import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HYDRO_TILES } from '@/features/parcels';
import { hydroTiles } from '@/lib/hydro-map';
import { renderWithIntl } from '@/test/render-intl';

import { FIELD_REPORT } from '../../fixtures/field-report';
import { LOW_CONFIDENCE_REPORT } from '../../fixtures/low-confidence-report';
import { fieldZones } from '../../utils/report-data';
import { FieldMap } from './field-map';

const FIELD = LOW_CONFIDENCE_REPORT.field;
const ZONES = fieldZones(FIELD_REPORT);
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
    // fakty o otoczeniu jako kafle: podpis i wartosc
    expect(screen.getByTestId('field-map-nearest')).toHaveTextContent(
      'Najbliższy rów melioracyjnyPrzy samym polu',
    );
    expect(screen.getByTestId('field-map-nearest')).toHaveTextContent(
      'Rzeki, strumienie i kanałyBrak w promieniu 500 m',
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
    expect(screen.getByTestId('field-sketch-label').textContent?.replaceAll('\u00a0', ' ')).toMatch(
      /^Szkic: Działka 6509 i woda w promieniu 250 m od pola\. Rów na skraju pola/,
    );
    expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Granica pola');
    expect(screen.getByTestId('field-sketch-legend')).toHaveTextContent('Rowy melioracyjne');
    expect(screen.getByTestId('field-map')).toHaveTextContent('Szkic w skali, północ u góry');
    expect(screen.queryByTestId('field-map-canvas')).toBeNull();

    expect(screen.getByRole('button', { name: 'Szkic' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Zdjęcie lotnicze' }));

    expect(screen.getByRole('button', { name: 'Zdjęcie lotnicze' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Szkic' })).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem('gtz-field-map-mode')).toBe('aerial');
    // bez miejsc na polu tylko dwie warstwy
    expect(screen.getByRole('checkbox', { name: 'Zdjęcie lotnicze' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Rowy i cieki' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Miejsca na polu' })).toBeNull();
  });

  it('zapamietany wybor zdjecia lotniczego; miejsca na polu wlaczone od razu i z legenda wzorow', () => {
    window.localStorage.setItem('gtz-field-map-mode', 'aerial');
    renderWithIntl(
      <QueryClientProvider client={clientWithTiles()}>
        <FieldMap field={FIELD} zones={ZONES} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('field-map')).toHaveAttribute('data-mode', 'aerial');
    const zonesLayer = screen.getByRole('checkbox', { name: 'Miejsca na polu' });

    expect(zonesLayer).toBeChecked();
    expect(screen.getByTestId('field-map-zone-legend')).toHaveTextContent('Kropki');

    fireEvent.click(zonesLayer);
    expect(zonesLayer).not.toBeChecked();
    expect(screen.queryByTestId('field-map-zone-legend')).toBeNull();
    window.localStorage.removeItem('gtz-field-map-mode');
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

  it('cztery tryby obrazu; kondycja roslin z satelity: obraz z numerami miejsc, skala slowami i data zdjecia', () => {
    const client = clientWithTiles();
    const [west, south, east, north] = FIELD_REPORT.field.bbox;

    client.setQueryData(['imagery', 'vegetation', 'a', '2018-06-15', 'condition'], {
      layer: 'condition',
      images: [{ image: 'data:image/png;base64,AAAA', bbox: [west, south, east, north] }],
      bbox: [west, south, east, north],
      requestedDate: '2018-06-15',
      sceneDate: '2018-05-29',
      sceneCloudCover: 3,
      clearShare: 1,
      scale: { low: 0.41, high: 0.83, mean: 0.66 },
    });
    renderWithIntl(
      <QueryClientProvider client={client}>
        <FieldMap field={FIELD_REPORT.field} zones={ZONES} imageryParcels="a" imageryDate="2018-06-15" />
      </QueryClientProvider>,
    );

    const modes = within(screen.getByTestId('field-map-mode')).getAllByRole('button');

    expect(modes.map((button) => button.textContent)).toEqual([
      'Szkic',
      'Zdjęcie lotnicze',
      'Kondycja roślin',
      'Woda w roślinach',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Kondycja roślin' }));

    expect(screen.getByTestId('field-map')).toHaveAttribute('data-mode', 'condition');
    expect(screen.getAllByTestId('satellite-zone-number')).toHaveLength(ZONES.length);
    expect(screen.getByTestId('field-satellite-notes')).toHaveTextContent('słabiej');
    expect(screen.getByTestId('field-satellite-notes')).toHaveTextContent(
      'Zdjęcie satelitarne z 29 maja 2018.',
    );
    window.localStorage.removeItem('gtz-field-map-mode');
  });

  it('wlasny obrys bez dzialek: jedno zdanie i powrot do szkicu jednym kliknieciem', () => {
    window.localStorage.setItem('gtz-field-map-mode', 'moisture');
    renderWithIntl(
      <QueryClientProvider client={clientWithTiles()}>
        <FieldMap field={FIELD} imageryParcels={null} imageryDate="2018-06-15" />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('field-satellite-state')).toHaveAttribute('data-state', 'noParcels');
    fireEvent.click(screen.getByTestId('field-satellite-back'));
    expect(screen.getByTestId('field-map')).toHaveAttribute('data-mode', 'sketch');
    window.localStorage.removeItem('gtz-field-map-mode');
  });
});
