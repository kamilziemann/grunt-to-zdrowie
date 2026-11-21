// Publiczne API feature "auth": opcjonalne konta (Better Auth w API pod `/api/auth` tego samego Workera, ADR 0002),
// tozsamosc jako zapytanie (`meQuery`) i stan auth dla ochrony tras (`resolveAuthState`).
export { AuthError, authErrorKind, classifyAuthError, type AuthErrorKind } from './api/auth-error';
export { signInWithEmail, signOutUser, signUpWithEmail } from './api/auth.api';
export { meQuery, resolveAuthState, toAuthState, type AuthState } from './api/auth.queries';
export { AccountCard } from './components/account-card';
export { AuthDisabledNotice } from './components/auth-disabled-notice';
export { SignInForm, type SignInFormProps } from './components/sign-in-form';
export { SignOutButton, type SignOutButtonProps } from './components/sign-out-button';
export { SignUpForm } from './components/sign-up-form';
export { UserMenu } from './components/user-menu';
export { useSignIn, useSignOut, useSignUp } from './hooks/use-auth-actions';
export { useMe } from './hooks/use-me';
