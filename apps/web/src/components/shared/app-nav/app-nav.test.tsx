import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IntlTestProvider } from '@/test/render-intl';

import { AppNav } from './app-nav';

const nav = vi.hoisted(() => ({ pathname: vi.fn<() => string>() }));

vi.mock('@/lib/navigation', async () => ({
  ...(await import('@/test/navigation-double')),
  usePathname: nav.pathname,
  useRouter: () => ({ refresh: vi.fn<() => void>() }),
}));

function renderNav() {
  return render(
    <IntlTestProvider>
      <AppNav appName="Grunt to Zdrowie" />
    </IntlTestProvider>,
  );
}

describe('AppNav', () => {
  it('pokazuje logo i pozycje menu z poprawnymi adresami', () => {
    nav.pathname.mockReturnValue('/raport');
    renderNav();

    expect(screen.getByRole('navigation', { name: 'Nawigacja główna' })).toBeInTheDocument();

    // pozycje sa dwa razy: w pasku (komputer) i w menu telefonu (popover)
    for (const link of screen.getAllByRole('link', { name: 'Design system' })) {
      expect(link).toHaveAttribute('href', '/design');
    }

    expect(screen.getByRole('link', { name: /^Grunt to Zdrowie/ })).toHaveAttribute('href', '/');
  });

  it.each(['/design', '/design/kolory'])('dla %s aktywna jest pozycja Design system', (pathname) => {
    nav.pathname.mockReturnValue(pathname);
    renderNav();

    for (const link of screen.getAllByRole('link', { name: 'Design system' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
  });

  it('nie ma przełącznika motywu (tylko jasny)', () => {
    nav.pathname.mockReturnValue('/');
    renderNav();

    expect(screen.queryByRole('button', { name: /Motyw/ })).not.toBeInTheDocument();
  });

  it('na stronie głównej kotwice sekcji i „Sprawdź działkę” zamiast pozycji menu', () => {
    nav.pathname.mockReturnValue('/');
    renderNav();

    for (const [name, href] of [
      ['Jak to działa', '#jak'],
      ['Co dostaniesz', '#wynik'],
      ['Pytania', '#pytania'],
      ['Sprawdź działkę', '#szukaj'],
    ]) {
      for (const link of screen.getAllByRole('link', { name })) expect(link).toHaveAttribute('href', href);
    }

    expect(screen.queryByRole('link', { name: 'Sprawdź inną działkę' })).not.toBeInTheDocument();
  });

  it('na stronie głównej żadna sekcja nie jest aktywna', () => {
    nav.pathname.mockReturnValue('/');
    renderNav();

    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toEqual([]);
  });
});
