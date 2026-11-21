import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { LOCALES } from '@/lib/locale';
import { LocaleSwitcher } from './locale-switcher';

describe('LocaleSwitcher', () => {
  it('prowadzi do strony w jezyku docelowym, a nazwa zaczyna sie od widocznego skrotu (WCAG 2.5.3)', () => {
    renderWithIntl(<LocaleSwitcher locales={LOCALES} />);

    const link = screen.getByRole('link', { name: 'EN - zmień język na English' });

    expect(link).toHaveTextContent('EN');
    expect(link).toHaveAttribute('href', '/en');
    expect(link).not.toHaveAttribute('lang');
  });

  it('po angielsku proponuje polski', () => {
    renderWithIntl(<LocaleSwitcher locales={LOCALES} />, 'en');

    expect(screen.getByRole('link', { name: 'PL - switch language to Polski' })).toHaveAttribute('href', '/');
  });
});
