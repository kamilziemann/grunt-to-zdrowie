import type { MeUser } from '@app/contracts';
import { useTranslations } from 'use-intl';

import { SignOutButton } from '../sign-out-button';

/** Dane zalogowanego uzytkownika na stronie konta: e-mail, role i wylogowanie. */
export function AccountCard({ user }: { user: MeUser }) {
  const t = useTranslations('auth.account');

  return (
    <section
      aria-labelledby="account-card-title"
      className="flex flex-col gap-5 rounded-lg border bg-card p-6 sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="account-card-title" className="font-bold tracking-tight m-0 text-2xl font-semibold">
          {t('cardTitle')}
        </h2>
        <p className="m-0 text-muted-foreground">{t('cardDescription')}</p>
      </div>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3">
        <dt className="text-muted-foreground">{t('email')}</dt>
        <dd data-testid="account-email" className="m-0 truncate font-semibold">
          {user.email}
        </dd>
        <dt className="text-muted-foreground">{t('roles')}</dt>
        <dd className="m-0">{user.roles.length > 0 ? user.roles.join(', ') : t('noRoles')}</dd>
      </dl>
      <div>
        <SignOutButton variant="outline" />
      </div>
    </section>
  );
}
