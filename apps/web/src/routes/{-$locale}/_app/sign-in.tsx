// Logowanie: wylaczone auth = komunikat zamiast formularza; zalogowany trafia na strone
// z `?next=` (z niej przekierowala grupa chroniona), a bez niej na konto. Stan zalezy od sesji, wiec strona renderuje
// sie w przegladarce (`ssr: false`) - HTML z serwera to sama powloka, bez cache brzegowego.
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { useTranslations } from 'use-intl';

import { PageHeader } from '@/components/shared/page-header';
import { ProblemAlert } from '@/components/shared/problem-alert';
import { Card, CardContent } from '@/components/ui/card';
import { AuthDisabledNotice, meQuery, resolveAuthState, SignInForm } from '@/features/auth';
import { localizePath } from '@/lib/locale';
import { routes, safeNextPath } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/sign-in')({
  ssr: false,
  validateSearch: z.object({ next: z.string().max(2000).optional().catch(undefined) }),
  beforeLoad: async ({ context: { queryClient, locale }, search }) => {
    const auth = await resolveAuthState(() => queryClient.query({ ...meQuery(), staleTime: 'static' }));
    const next = safeNextPath(search.next);

    if (auth.kind === 'authenticated')
      throw redirect({ href: localizePath(next ?? routes.account(), locale) });

    return { auth, next };
  },
  head: ({ matches }) =>
    pageHead({
      title: headTranslator(matches, 'auth')('signIn.title'),
      noindex: true,
      locale: headLocale(matches).locale,
      path: routes.signIn(),
    }),
  component: SignInPage,
});

function SignInPage() {
  const { auth, next } = Route.useRouteContext();
  const t = useTranslations('auth');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader
        title={t('signIn.title')}
        description={auth.kind === 'disabled' ? undefined : t('signIn.description')}
      />
      {auth.kind === 'disabled' && <AuthDisabledNotice />}
      {auth.kind === 'error' && <ProblemAlert problem={auth.problem} title={t('unavailable')} />}
      {auth.kind === 'anonymous' && (
        <Card>
          <CardContent className="pt-6">
            <SignInForm next={next} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
