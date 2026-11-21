// Tozsamosc zalogowanego uzytkownika (uwierzytelnianie opcjonalne, patrz ADR 0002) i odpowiedz GET /me.
// `Identity` jest jedynym, co serwisy wiedza o uzytkowniku: nie importuja Better Auth ani Hono, dostaja ja jawnie.
import { z } from 'zod';

/** Role to zwykle napisy z rekordu uzytkownika (domyslnie pusta lista); znaczenie nadaje dopiero projekt (polityki). */
export const identitySchema = z.object({
  userId: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
});

export type Identity = z.infer<typeof identitySchema>;

/**
 * Role zespolu nadawane przez backend (`user.roles`, skrypt `bun run admin:grant`); znaczenie
 * nadaja im polityki (domain/authorization). Jedna stala dla polityk serwera i widocznosci w web.
 */
export const STAFF_ROLES = { editor: 'editor', admin: 'admin' } as const;

export type StaffRole = (typeof STAFF_ROLES)[keyof typeof STAFF_ROLES];

export const meUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
});

export type MeUser = z.infer<typeof meUserSchema>;

/** Odpowiedz GET /me: dziala tez przy wylaczonym auth (`authEnabled: false`, `authenticated: false`). */
export const meSchema = z.object({
  authEnabled: z.boolean(),
  authenticated: z.boolean(),
  user: meUserSchema.nullable(),
});

export type Me = z.infer<typeof meSchema>;

/** Limity pol logowania/rejestracji; zgodne z domyslnymi ograniczeniami hasla w Better Auth (8-128 znakow). */
export const AUTH_LIMITS = {
  passwordMin: 8,
  passwordMax: 128,
  nameMax: 80,
} as const;

const emailInputSchema = z.string().trim().max(254).pipe(z.email());
const passwordInputSchema = z.string().min(AUTH_LIMITS.passwordMin).max(AUTH_LIMITS.passwordMax);

/** Wejscie formularza logowania (walidacja w przegladarce; serwer waliduje je wlasnymi regulami Better Auth). */
export const signInInputSchema = z.object({ email: emailInputSchema, password: z.string().min(1) });

export type SignInInput = z.infer<typeof signInInputSchema>;

/** Wejscie formularza rejestracji. */
export const signUpInputSchema = z.object({
  name: z.string().trim().min(1).max(AUTH_LIMITS.nameMax),
  email: emailInputSchema,
  password: passwordInputSchema,
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;
