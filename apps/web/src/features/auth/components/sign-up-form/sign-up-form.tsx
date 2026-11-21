import { Link } from '@/lib/navigation';
import { useRouter } from '@/lib/navigation';
import { useTranslations } from 'use-intl';
import { useCallback, useId, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';

import { routes } from '@/lib/routes';

import { useSignUp } from '../../hooks/use-auth-actions';
import {
  AUTH_FIELD_LIMITS,
  EMPTY_SIGN_UP,
  validateSignUpForm,
  type SignUpErrors,
  type SignUpValues,
} from '../../schemas/auth-form.schema';
import { AuthErrorAlert } from '../auth-error-alert';
import { AuthField } from '../auth-field';

/** Rejestracja (imie, e-mail, haslo); po sukcesie Better Auth od razu zaklada sesje. */
export function SignUpForm() {
  const t = useTranslations('auth');
  const id = useId();
  const router = useRouter();
  const { mutate, isPending, error } = useSignUp();
  const [values, setValues] = useState<SignUpValues>(EMPTY_SIGN_UP);
  const [errors, setErrors] = useState<SignUpErrors>({});

  const changeName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, name: event.target.value }));
  }, []);
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
      const result = validateSignUpForm(values);

      if (!result.ok) {
        // Fokus na pierwsze bledne pole (po renderze bledow): czytnik odczyta etykiete i komunikat bledu.
        flushSync(() => setErrors(result.errors));
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

        return;
      }

      setErrors({});
      mutate(result.data, {
        onSuccess: () => {
          router.push(routes.account());
          router.refresh();
        },
      });
    },
    [values, mutate, router],
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <AuthField
        id={`${id}-name`}
        label={t('fields.name')}
        autoComplete="name"
        value={values.name}
        onChange={changeName}
        error={errors.name ? t('errors.name', { max: AUTH_FIELD_LIMITS.nameMax }) : undefined}
        disabled={isPending}
      />
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
        autoComplete="new-password"
        value={values.password}
        onChange={changePassword}
        error={
          errors.password
            ? t('errors.password', { min: AUTH_FIELD_LIMITS.passwordMin, max: AUTH_FIELD_LIMITS.passwordMax })
            : undefined
        }
        disabled={isPending}
      />
      {error && <AuthErrorAlert error={error} />}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md transition-colors hover:bg-primary/90 inline-flex h-13 items-center justify-center bg-primary px-6 text-[17px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t('signUp.submitting') : t('signUp.submit')}
      </button>
      {/* Link przelaczajacy formularz to cel 44 px; ujemny margines zostawia wysokosc linii jak przy samym tekscie. */}
      <p className="m-0 text-[15px] text-muted-foreground">
        {t('signUp.haveAccount')}{' '}
        <Link
          href={routes.signIn()}
          className="inline-flex min-h-11 items-center -my-3 font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('signUp.toSignIn')}
        </Link>
      </p>
    </form>
  );
}
