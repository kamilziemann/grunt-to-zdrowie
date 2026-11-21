import { render, screen } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthField } from './auth-field';

const NOOP = vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>();

function renderField(error?: string) {
  const view = render(
    <AuthField
      id="email"
      label="E-mail"
      type="email"
      value=""
      autoComplete="email"
      error={error}
      onChange={NOOP}
    />,
  );

  return { field: screen.getByLabelText('E-mail'), container: view.container };
}

describe('AuthField', () => {
  it('poprawne pole nie jest oznaczone jako błędne i nie wskazuje opisu', () => {
    const { field } = renderField();

    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
    expect(field).not.toHaveAccessibleDescription();
  });

  it('błąd oznacza pole i jest jego opisem dla czytnika ekranu', () => {
    const { field } = renderField('Podaj poprawny adres e-mail.');

    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('Podaj poprawny adres e-mail.');
  });

  it('pusty komunikat błędu = pole poprawne, bez pustego akapitu', () => {
    const { field, container } = renderField('');

    expect(field).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('#email-error')).toBeNull();
  });
});
