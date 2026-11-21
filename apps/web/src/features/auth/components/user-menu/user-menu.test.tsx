import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@app/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import { IntlTestProvider, translator } from '@/test/render-intl';

import { UserMenu } from './user-menu';

vi.mock('@/lib/navigation', async () => ({
  ...(await import('@/test/navigation-double')),
  useRouter: () => ({ push: vi.fn<() => void>(), refresh: vi.fn<() => void>() }),
}));
vi.mock('../../api/auth.api', () => ({
  fetchMe: vi.fn<() => Promise<Me>>(),
  signOutUser: vi.fn<() => Promise<void>>(),
}));

const t = translator('auth');

function renderMenu(me: Me) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });

  // tozsamosc w cache (jak po GET /me) - menu czyta ja przez useMe
  client.setQueryData(queryKeys.auth.me(), me);

  return render(
    <QueryClientProvider client={client}>
      <IntlTestProvider>
        <UserMenu />
      </IntlTestProvider>
    </QueryClientProvider>,
  );
}

describe('UserMenu', () => {
  it('przy wyłączonym auth nie renderuje nic', () => {
    const { container } = renderMenu({ authEnabled: false, authenticated: false, user: null });

    expect(container).toBeEmptyDOMElement();
  });

  it('niezalogowany widzi link do logowania', () => {
    renderMenu({ authEnabled: true, authenticated: false, user: null });

    expect(screen.getByRole('link', { name: t('menu.signIn') })).toHaveAttribute('href', '/sign-in');
  });

  it('zalogowany widzi e-mail (link do konta) i przycisk wylogowania', () => {
    renderMenu({
      authEnabled: true,
      authenticated: true,
      user: { id: 'u1', email: 'ala@example.com', roles: [] },
    });

    expect(screen.getByRole('link', { name: 'ala@example.com' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('button', { name: t('menu.signOut') })).toBeInTheDocument();
  });
});
