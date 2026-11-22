import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { MethodPage } from './method-page';

describe('MethodPage', () => {
  it('po polsku: ocena, czego nie wiemy, pewność i 10 źródeł z licencją i linkiem', () => {
    renderWithIntl(<MethodPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Jak liczymy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deszcz minus parowanie z 60 dni' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Czego nie wiemy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jak czytać pewność' })).toBeInTheDocument();

    const sources = screen.getByTestId('method-sources').querySelectorAll(':scope > li');

    expect(sources).toHaveLength(10);
    expect(screen.getByRole('heading', { name: 'Upał jako wyjaśnienie' })).toBeInTheDocument();
    expect(screen.getByText(/powyżej 30°C/, { selector: 'p' })).toHaveTextContent('IMGW-PIB');
    expect(screen.getByText(/w 21 przypadkach/)).toBeInTheDocument();
    expect(screen.getByText(/Zastawek i przepustów na rowach ta mapa nie ma/)).toBeInTheDocument();

    for (const source of sources) {
      expect(source.querySelector('a[href^="https://"]')).not.toBeNull();
      expect(source).toHaveTextContent('Licencja');
    }
  });

  it('po angielsku z tymi samymi częściami', () => {
    renderWithIntl(<MethodPage />, 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'How we calculate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What we do not know' })).toBeInTheDocument();
    expect(screen.getByText(/Weather comes from a grid of about 50 km/)).toBeInTheDocument();
  });
});
