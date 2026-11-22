import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/providers/theme-provider';
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
      <ThemeProvider>
        <AppNav appName="Grunt to Zdrowie" />
      </ThemeProvider>
    </IntlTestProvider>,
  );
}

describe('AppNav', () => {
  it('pokazuje logo i pozycje menu z poprawnymi adresami', () => {
    nav.pathname.mockReturnValue('/');
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

  it('przełącznik motywu cyklicznie zmienia ciasteczko i atrybut na <html>', () => {
    nav.pathname.mockReturnValue('/');
    renderNav();

    fireEvent.click(screen.getAllByRole('button', { name: /Motyw: systemowy/ })[0] as HTMLElement);
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getAllByRole('button', { name: /Motyw: jasny/ })[0] as HTMLElement);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getAllByRole('button', { name: /Motyw: ciemny/ })[0] as HTMLElement);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('na stronie głównej żadna sekcja nie jest aktywna', () => {
    nav.pathname.mockReturnValue('/');
    renderNav();

    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toEqual([]);
  });
});
