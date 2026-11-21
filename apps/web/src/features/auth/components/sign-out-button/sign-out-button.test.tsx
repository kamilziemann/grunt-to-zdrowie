// Testy wylogowania: koniec sesji w API, potem logowanie i odswiezenie danych serwerowych; blad zostawia strone.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IntlTestProvider, translator } from '@/test/render-intl';

import { SignOutButton } from './sign-out-button';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<void>>(),
  push: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}));

vi.mock('../../api/auth.api', () => ({ signOutUser: mocks.signOut }));
vi.mock('@/lib/navigation', async () => ({
  ...(await import('@/test/navigation-double')),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const t = translator('auth');

function renderButton() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <IntlTestProvider>
        <SignOutButton />
      </IntlTestProvider>
    </QueryClientProvider>,
  );
}

describe('SignOutButton', () => {
  beforeEach(() => {
    mocks.signOut.mockReset();
    mocks.push.mockClear();
    mocks.refresh.mockClear();
  });

  it('po wylogowaniu prowadzi do logowania i odswieza dane', async () => {
    mocks.signOut.mockResolvedValue(undefined);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: t('menu.signOut') }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/sign-in'));
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: t('menu.signOut') })).toHaveAttribute('data-slot', 'button');
  });

  it('w trakcie wylogowania przycisk jest wylaczony i mowi, co sie dzieje', async () => {
    let finish = () => {};

    mocks.signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: t('menu.signOut') }));

    const pending = await screen.findByRole('button', { name: t('menu.signingOut') });

    expect(pending).toBeDisabled();
    expect(mocks.push).not.toHaveBeenCalled();

    finish();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/sign-in'));
  });

  it('nieudane wylogowanie zostawia strone i oddaje przycisk', async () => {
    mocks.signOut.mockRejectedValue(new Error('offline'));
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: t('menu.signOut') }));

    await waitFor(() => expect(screen.getByRole('button', { name: t('menu.signOut') })).toBeEnabled());
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
