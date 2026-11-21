import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { PageHeader } from './page-header';
import { routes } from '@/lib/routes';

const TRAIL = [{ label: 'Działki', href: routes.home() }, { label: 'Działka 12/3' }];

describe('PageHeader', () => {
  it('pokazuje ścieżkę, tytuł, opis i akcję', () => {
    renderWithIntl(
      <PageHeader title="Działka 12/3" description="Dąbrowa, gmina Krośnice" breadcrumbs={TRAIL}>
        <button type="button">Zapisz</button>
      </PageHeader>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Działka 12/3' })).toBeInTheDocument();
    expect(screen.getByText('Dąbrowa, gmina Krośnice')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Działki' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeInTheDocument();
  });

  it('bez akcji i ścieżki renderuje sam tytuł', () => {
    renderWithIntl(<PageHeader title="Działki" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
