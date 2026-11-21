import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IntlTestProvider, translator } from '@/test/render-intl';

import { AuthError } from '../../api/auth-error';
import { SignUpForm } from './sign-up-form';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn<(input: { name: string; email: string; password: string }) => Promise<void>>(),
  push: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}));

vi.mock('../../api/auth.api', () => ({ signUpWithEmail: mocks.signUp }));
vi.mock('@/lib/navigation', async () => ({
  ...(await import('@/test/navigation-double')),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <IntlTestProvider>
        <SignUpForm />
      </IntlTestProvider>
    </QueryClientProvider>,
  );
}

const t = translator('auth');

function fill(name: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText(t('fields.name')), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(t('fields.email')), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(t('fields.password')), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: t('signUp.submit') }));
}

describe('SignUpForm', () => {
  it('waliduje długość hasła schematem z kontraktu', () => {
    renderForm();
    fill('Ala', 'ala@example.com', 'krotkie');

    expect(screen.getByText(t('errors.password', { min: 8, max: 128 }))).toBeInTheDocument();
    // Jedyne bledne pole dostaje fokus, a jego opis to komunikat bledu.
    expect(screen.getByLabelText(t('fields.password'))).toHaveFocus();
    expect(screen.getByLabelText(t('fields.password'))).toHaveAccessibleDescription(
      t('errors.password', { min: 8, max: 128 }),
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('wysyła przycięte dane i prowadzi na /account', async () => {
    mocks.signUp.mockResolvedValue(undefined);
    renderForm();
    fill(' Ala ', 'ala@example.com', 'dlugie-haslo');

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/account'));
    expect(mocks.signUp).toHaveBeenCalledWith({
      name: 'Ala',
      email: 'ala@example.com',
      password: 'dlugie-haslo',
    });
  });

  it('istniejące konto to komunikat, nie przekierowanie', async () => {
    mocks.signUp.mockRejectedValue(new AuthError('userExists'));
    renderForm();
    fill('Ala', 'ala@example.com', 'dlugie-haslo');

    expect(await screen.findByRole('alert')).toHaveTextContent(t('errors.userExists'));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
