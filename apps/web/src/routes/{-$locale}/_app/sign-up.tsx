// Rejestracja: wylaczone auth = komunikat zamiast formularza; zalogowany trafia na konto.
// Stan zalezy od sesji, wiec strona renderuje sie w przegladarce (`ssr: false`), bez cache brzegowego.
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { PageHeader } from '@/components/shared/page-header';
import { ProblemAlert } from '@/components/shared/problem-alert';
import { Card, CardContent } from '@/components/ui/card';
import { AuthDisabledNotice, meQuery, resolveAuthState, SignUpForm } from '@/features/auth';
import { localizePath } from '@/lib/locale';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/sign-up')({
  ssr: false,
  beforeLoad: async ({ context: { queryClient, locale } }) => {
    const auth = await resolveAuthState(() => queryClient.query({ ...meQuery(), staleTime: 'static' }));

    if (auth.kind === 'authenticated') throw redirect({ href: localizePath(routes.account(), locale) });

    return { auth };
  },
  head: ({ matches }) =>
    pageHead({
      title: headTranslator(matches, 'auth')('signUp.title'),
      noindex: true,
      locale: headLocale(matches).locale,
      path: routes.signUp(),
    }),
  component: SignUpPage,
});

function SignUpPage() {
  const { auth } = Route.useRouteContext();
  const t = useTranslations('auth');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader
        title={t('signUp.title')}
        description={auth.kind === 'disabled' ? undefined : t('signUp.description')}
      />
      {auth.kind === 'disabled' && <AuthDisabledNotice />}
      {auth.kind === 'error' && <ProblemAlert problem={auth.problem} title={t('unavailable')} />}
      {auth.kind === 'anonymous' && (
        <Card>
          <CardContent className="pt-6">
            <SignUpForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
