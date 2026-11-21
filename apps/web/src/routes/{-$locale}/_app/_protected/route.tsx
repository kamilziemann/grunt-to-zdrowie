// Grupa tras chronionych (konto): przy wlaczonym auth wymaga sesji - bez niej przekierowanie
// na logowanie z powrotem na te strone; przy wylaczonym auth strony dzialaja normalnie. Strony prywatne renderuja sie
// w przegladarce (`ssr: false`): HTML z serwera to sama powloka, dane uzytkownika nie przechodza przez SSR.
// Ochrona w routerze to UX - prawdziwa autoryzacje kazdego zapytania robi API.
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { meQuery, resolveAuthState } from '@/features/auth';
import { ProblemAlert } from '@/components/shared/problem-alert';
import { localizePath } from '@/lib/locale';
import { routes } from '@/lib/routes';

export const Route = createFileRoute('/{-$locale}/_app/_protected')({
  ssr: false,
  beforeLoad: async ({ context: { queryClient, locale }, location }) => {
    const auth = await resolveAuthState(() => queryClient.query({ ...meQuery(), staleTime: 'static' }));

    if (auth.kind === 'anonymous') {
      throw redirect({ href: localizePath(routes.signIn(location.href), locale) });
    }

    return { auth };
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { auth } = Route.useRouteContext();
  const t = useTranslations('auth');

  // Nie da sie ustalic, czy sesja jest wymagana (API niedostepne): zamykamy, zamiast przepuszczac.
  if (auth.kind === 'error') {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <ProblemAlert problem={auth.problem} title={t('unavailable')} />
      </div>
    );
  }

  return <Outlet />;
}
