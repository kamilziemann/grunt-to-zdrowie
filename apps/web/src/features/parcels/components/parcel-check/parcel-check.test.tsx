import type { Parcel } from '@app/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { parcelsKeys } from '../../api/parcels.queries';
import { ParcelCheck } from './parcel-check';

const PARCEL: Parcel = {
  id: '080904_5.0001.349/1',
  number: '349/1',
  region: 'Chwalim',
  commune: 'Kargowa',
  county: 'powiat zielonogórski',
  voivodeship: 'lubuskie',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [15.85, 52.08],
        [15.86, 52.08],
        [15.86, 52.09],
        [15.85, 52.08],
      ],
    ],
  },
  bbox: [15.85, 52.08, 15.86, 52.09],
  centroid: [15.855, 52.085],
  areaHa: 19.35,
  source: 'egib-wfs',
  fetchedAt: '2026-11-22T00:00:00Z',
};

const IDS = [PARCEL.id];

function renderCheck(parcel: Parcel | null) {
  const client = new QueryClient();

  client.setQueryData(parcelsKeys.detail(PARCEL.id), parcel);

  return renderWithIntl(
    <QueryClientProvider client={client}>
      <ParcelCheck ids={IDS} />
    </QueryClientProvider>,
  );
}

describe('ParcelCheck', () => {
  it('pokazuje opis dzialki, uzytek z ewidencji i pytanie o cala dzialke', () => {
    renderCheck({ ...PARCEL, landUse: ['RIVb', 'ŁV'] });

    expect(screen.getByRole('heading', { level: 1, name: 'Czy to Twoja działka?' })).toBeInTheDocument();
    expect(screen.getByTestId('parcel-facts')).toHaveTextContent('Chwalim');
    expect(screen.getByTestId('parcel-facts')).toHaveTextContent('RIVb, ŁV');
    expect(screen.queryByTestId('non-farm')).toBeNull();
    expect(screen.getByRole('link', { name: 'To nie ta działka' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Tylko część' })).toHaveAttribute(
      'href',
      '/mapa?dzialki=080904_5.0001.349%2F1&rysuj=podziel',
    );
  });

  it('las wg ewidencji: ostrzezenie, ale mozna liczyc dalej', () => {
    renderCheck({ ...PARCEL, landUse: ['LsV'] });

    expect(screen.getByTestId('non-farm')).toHaveTextContent('las');
  });

  it('brak dzialki: komunikat z poprawa numeru i mapa', () => {
    renderCheck(null);

    expect(screen.getByRole('heading', { name: 'Nie znaleźliśmy takiej działki' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Popraw numer' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Wskaż działkę na mapie/ })).toHaveAttribute('href', '/mapa');
  });
});
