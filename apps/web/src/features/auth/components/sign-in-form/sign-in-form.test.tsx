import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IntlTestProvider, translator } from '@/test/render-intl';

import { AuthError } from '../../api/auth-error';
import { SignInForm } from './sign-in-form';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn<(input: { email: string; password: string }) => Promise<void>>(),
  push: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}));

vi.mock('../../api/auth.api', () => ({ signInWithEmail: mocks.signIn }));
vi.mock('@/lib/navigation', async () => ({
  ...(await import('@/test/navigation-double')),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

function renderForm(next?: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <IntlTestProvider>
        <SignInForm next={next} />
      </IntlTestProvider>
    </QueryClientProvider>,
  );
}

function signInAs(email: string) {
  fireEvent.change(screen.getByLabelText(t('fields.email')), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(t('fields.password')), { target: { value: 'haslo-123' } });
  fireEvent.click(screen.getByRole('button', { name: t('signIn.submit') }));
}

const t = translator('auth');

describe('SignInForm', () => {
  it('nie wysyła pustego formularza i opisuje błędy pól', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: t('signIn.submit') }));

    expect(screen.getByLabelText(t('fields.email'))).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(t('errors.passwordRequired'))).toBeInTheDocument();
    // Fokus na pierwszym blednym polu (e-mail), nie na przycisku.
    expect(screen.getByLabelText(t('fields.email'))).toHaveFocus();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('po poprawnym logowaniu przekierowuje na start i odświeża dane serwerowe', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    renderForm();
    fireEvent.change(screen.getByLabelText(t('fields.email')), { target: { value: 'ala@example.com' } });
    fireEvent.change(screen.getByLabelText(t('fields.password')), { target: { value: 'haslo-123' } });
    fireEvent.click(screen.getByRole('button', { name: t('signIn.submit') }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'));
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'ala@example.com', password: 'haslo-123' });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('po logowaniu wraca na strone chroniona z `next`', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    renderForm('/account?tab=sesje');
    signInAs('ala@example.com');

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account?tab=sesje'));
  });

  it('obcy adres w `next` konczy sie na koncie', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    renderForm('//zly.example/admin');
    signInAs('ala@example.com');

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'));
  });

  it('błąd Better Auth pokazuje jako przetłumaczony komunikat', async () => {
    mocks.signIn.mockRejectedValue(new AuthError('invalidCredentials'));
    renderForm();
    fireEvent.change(screen.getByLabelText(t('fields.email')), { target: { value: 'ala@example.com' } });
    fireEvent.change(screen.getByLabelText(t('fields.password')), { target: { value: 'zle' } });
    fireEvent.click(screen.getByRole('button', { name: t('signIn.submit') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('errors.invalidCredentials'));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
