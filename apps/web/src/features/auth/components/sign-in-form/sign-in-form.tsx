import { Link } from '@/lib/navigation';
import { useRouter } from '@/lib/navigation';
import { useTranslations } from 'use-intl';
import { useCallback, useId, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';

import { routes, safeNextPath } from '@/lib/routes';

import { useSignIn } from '../../hooks/use-auth-actions';
import {
  EMPTY_SIGN_IN,
  validateSignInForm,
  type SignInErrors,
  type SignInValues,
} from '../../schemas/auth-form.schema';
import { AuthErrorAlert } from '../auth-error-alert';
import { AuthField } from '../auth-field';

export interface SignInFormProps {
  /** Strona, z ktorej przekierowano na logowanie (`?next=`); tylko sciezka tej aplikacji, inaczej konto. */
  next?: string | null;
}

/** Logowanie e-mailem i haslem: walidacja schematem z kontraktu, blad Better Auth jako przetlumaczony komunikat. */
export function SignInForm({ next = null }: SignInFormProps) {
  const t = useTranslations('auth');
  const id = useId();
  const router = useRouter();
  const { mutate, isPending, error } = useSignIn();
  const [values, setValues] = useState<SignInValues>(EMPTY_SIGN_IN);
  const [errors, setErrors] = useState<SignInErrors>({});

  const changeEmail = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, email: event.target.value }));
  }, []);
  const changePassword = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, password: event.target.value }));
  }, []);

  const submit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const result = validateSignInForm(values);

      if (!result.ok) {
        // Fokus na pierwsze bledne pole (po renderze bledow): czytnik odczyta etykiete i komunikat bledu.
        flushSync(() => setErrors(result.errors));
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

        return;
      }

      setErrors({});
      mutate(result.data, {
        onSuccess: () => {
          // Po zalogowaniu wraca na strone, ktora wymagala sesji, a bez niej trafia na konto (e-mail i wylogowanie).
          router.push(safeNextPath(next) ?? routes.account());
          router.refresh();
        },
      });
    },
    [values, mutate, router, next],
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <AuthField
        id={`${id}-email`}
        label={t('fields.email')}
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={changeEmail}
        error={errors.email ? t('errors.email') : undefined}
        disabled={isPending}
      />
      <AuthField
        id={`${id}-password`}
        label={t('fields.password')}
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={changePassword}
        error={errors.password ? t('errors.passwordRequired') : undefined}
        disabled={isPending}
      />
      {error && <AuthErrorAlert error={error} />}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md transition-colors hover:bg-primary/90 inline-flex h-13 items-center justify-center bg-primary px-6 text-[17px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t('signIn.submitting') : t('signIn.submit')}
      </button>
      {/* Link przelaczajacy formularz to cel 44 px; ujemny margines zostawia wysokosc linii jak przy samym tekscie. */}
      <p className="m-0 text-[15px] text-muted-foreground">
        {t('signIn.noAccount')}{' '}
        <Link
          href={routes.signUp()}
          className="inline-flex min-h-11 items-center -my-3 font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('signIn.toSignUp')}
        </Link>
      </p>
    </form>
  );
}
