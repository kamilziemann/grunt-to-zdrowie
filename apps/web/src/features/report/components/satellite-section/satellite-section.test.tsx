// Blok "Pole z satelity" (tylko wydruk) bez sieci: pole bez dzialek = jedno zdanie, a zanim ktos kliknie "Zapisz PDF"
// - zdanie dla wydruku zamiast pustych ramek (na ekranie obrazy sa trybami karty "Twoje pole").
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { FIELD_REPORT } from '../../fixtures/field-report';
import { imageryRequest } from './satellite-print';
import { SatelliteSection } from './satellite-section';

function renderSection(report = FIELD_REPORT) {
  return renderWithIntl(
    <QueryClientProvider client={new QueryClient()}>
      <SatelliteSection report={report} />
    </QueryClientProvider>,
  );
}

describe('SatelliteSection', () => {
  it('tylko na wydruku; bez "Zapisz PDF" nic nie pobiera, wydruk dostaje zdanie, jak dolaczyc zdjecia', () => {
    renderSection();

    expect(screen.getByTestId('satellite-section')).toHaveClass('hidden', 'print:flex');
    expect(screen.getByTestId('satellite-not-loaded')).toHaveTextContent('Zapisz PDF');
    expect(screen.queryByTestId('satellite-images')).toBeNull();
  });

  it('pole narysowane bez dzialek: jedno zdanie zamiast obrazow', () => {
    renderSection({ ...FIELD_REPORT, field: { ...FIELD_REPORT.field, parcelIds: [] } });

    expect(screen.getByTestId('satellite-none')).toHaveTextContent('bez działek ewidencyjnych');
  });

  it('zapytanie: posortowane dzialki i dzien analizy', () => {
    const report = { ...FIELD_REPORT, field: { ...FIELD_REPORT.field, parcelIds: ['b', 'a'] } };

    expect(imageryRequest(report)).toEqual({ dzialki: 'a,b', date: '2018-06-15' });
  });
});
