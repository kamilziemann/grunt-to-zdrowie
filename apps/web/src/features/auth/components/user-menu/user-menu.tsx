import { User } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

import { useMe } from '../../hooks/use-me';
import { SignOutButton } from '../sign-out-button';

/**
 * Pozycja nawigacji zalezna od sesji. Przy wylaczonym auth (albo gdy `/me` jest niedostepne) nie renderuje nic, wiec
 * aplikacja wyglada jak bez kont. Stan ustala przegladarka (`/api/me`) - HTML strony jest wspolny dla CDN.
 */
export function UserMenu() {
  const t = useTranslations('auth.menu');
  const { data } = useMe();

  if (!data?.authEnabled) return null;

  if (data.authenticated && data.user) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href={routes.account()}>
            <User aria-hidden="true" />
            <span className="max-w-40 truncate">{data.user.email}</span>
          </Link>
        </Button>
        <SignOutButton />
      </div>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={routes.signIn()}>{t('signIn')}</Link>
    </Button>
  );
}
