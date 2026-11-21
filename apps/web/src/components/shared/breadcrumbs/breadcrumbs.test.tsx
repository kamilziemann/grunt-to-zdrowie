import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { Breadcrumbs } from './breadcrumbs';
import { routes } from '@/lib/routes';

const TRAIL = [
  { label: 'Działki', href: routes.home() },
  { label: 'Do analizy', href: routes.analysis() },
  { label: 'Działka 12/3' },
];
const NONE: { label: string }[] = [];

describe('Breadcrumbs', () => {
  it('linkuje poprzednie poziomy, a ostatni oznacza jako bieżącą stronę', () => {
    renderWithIntl(<Breadcrumbs items={TRAIL} />);
    const nav = screen.getByRole('navigation', { name: 'Ścieżka' });

    expect(within(nav).getByRole('link', { name: 'Działki' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Do analizy' })).toHaveAttribute('href', '/analiza');
    expect(within(nav).getByText('Działka 12/3')).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });

  it('bez elementów nic nie renderuje', () => {
    const { container } = renderWithIntl(<Breadcrumbs items={NONE} />);

    expect(container).toBeEmptyDOMElement();
  });
});
