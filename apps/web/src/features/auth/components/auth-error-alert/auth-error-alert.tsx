import { useTranslations } from 'use-intl';

import { authErrorKind } from '../../api/auth-error';

/**
 * Blad akcji auth jako komunikat w jezyku interfejsu (`auth.errors.<rodzaj>`), w stylu aplikacji. Bez 'use client':
 * dziala w drzewie klienta formularzy i na serwerze (prop `error` nie musi dac sie zserializowac).
 */
export function AuthErrorAlert({ error }: { error: unknown }) {
  const t = useTranslations('auth.errors');

  return (
    <p
      role="alert"
      className="m-0 flex items-start gap-3 rounded-lg border bg-card p-4 font-semibold text-destructive"
    >
      <span aria-hidden="true" className="mt-1.5 size-3 shrink-0 bg-destructive" />
      {t(authErrorKind(error))}
    </p>
  );
}
