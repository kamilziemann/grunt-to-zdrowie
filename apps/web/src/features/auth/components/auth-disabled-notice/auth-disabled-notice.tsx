import { Link } from '@/lib/navigation';
import { useTranslations } from 'use-intl';

import { routes } from '@/lib/routes';

/** Stan stron auth, gdy API ma AUTH_ENABLED=false: cala aplikacja jest dostepna bez logowania. */
export function AuthDisabledNotice() {
  const t = useTranslations('auth.disabled');

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 sm:p-8">
      <p className="m-0 inline-flex items-center gap-2.5 font-semibold">
        <span aria-hidden="true" className="size-3 bg-primary" />
        {t('title')}
      </p>
      <p className="m-0 text-muted-foreground">{t('description')}</p>
      <Link
        href={routes.home()}
        className="rounded-md transition-colors hover:bg-primary/90 inline-flex h-12 items-center self-start bg-primary px-5 font-semibold text-primary-foreground"
      >
        {t('home')}
      </Link>
    </div>
  );
}
