// Schematy formularzy = schematy z kontraktu (@app/contracts): ta sama walidacja w przegladarce i (ponownie) w API.
// Tu tylko mapowanie bledow na klucze komunikatow pol (`auth.errors.*` w messages/*.json).
import {
  AUTH_LIMITS,
  signInInputSchema,
  signUpInputSchema,
  type SignInInput,
  type SignUpInput,
} from '@app/contracts';

export interface SignInValues {
  email: string;
  password: string;
}

export interface SignUpValues extends SignInValues {
  name: string;
}

export type SignInErrors = Partial<Record<keyof SignInValues, true>>;
export type SignUpErrors = Partial<Record<keyof SignUpValues, true>>;

export const EMPTY_SIGN_IN: SignInValues = { email: '', password: '' };
export const EMPTY_SIGN_UP: SignUpValues = { name: '', email: '', password: '' };

/** Limity podstawiane do komunikatow bledow jako `{min}`/`{max}`. */
export const AUTH_FIELD_LIMITS = AUTH_LIMITS;

type Result<T, E> = { ok: true; data: T } | { ok: false; errors: E };

function fieldErrors<K extends string>(
  issues: readonly { path: readonly PropertyKey[] }[],
  fields: readonly K[],
) {
  const errors: Partial<Record<K, true>> = {};

  for (const issue of issues) {
    const field = fields.find((f) => f === issue.path[0]);

    if (field) errors[field] = true;
  }

  return errors;
}

export function validateSignInForm(values: SignInValues): Result<SignInInput, SignInErrors> {
  const parsed = signInInputSchema.safeParse(values);

  if (parsed.success) return { ok: true, data: parsed.data };

  return { ok: false, errors: fieldErrors(parsed.error.issues, ['email', 'password'] as const) };
}

export function validateSignUpForm(values: SignUpValues): Result<SignUpInput, SignUpErrors> {
  const parsed = signUpInputSchema.safeParse(values);

  if (parsed.success) return { ok: true, data: parsed.data };

  return { ok: false, errors: fieldErrors(parsed.error.issues, ['name', 'email', 'password'] as const) };
}
