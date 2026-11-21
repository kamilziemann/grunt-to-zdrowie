// Konto: dane i wylogowanie; wylaczone auth = komunikat. Stan auth ustala grupa `_protected` (bez sesji
// przekierowanie na logowanie, blad API = panel bledu), strona renderuje sie w przegladarce (`ssr: false` z grupy).
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { PageHeader } from '@/components/shared/page-header';
import { AccountCard, AuthDisabledNotice } from '@/features/auth';
import { routes } from '@/lib/routes';
import { headLocale, headTranslator, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/{-$locale}/_app/_protected/account')({
  head: ({ matches }) =>
    pageHead({
      title: headTranslator(matches, 'auth')('account.title'),
      noindex: true,
      locale: headLocale(matches).locale,
      path: routes.account(),
    }),
  component: AccountPage,
});

function AccountPage() {
  const { auth } = Route.useRouteContext();
  const t = useTranslations('auth');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader title={t('account.title')} description={t('account.description')} />
      {auth.kind === 'authenticated' && <AccountCard user={auth.me.user} />}
      {auth.kind === 'disabled' && <AuthDisabledNotice />}
    </div>
  );
}
