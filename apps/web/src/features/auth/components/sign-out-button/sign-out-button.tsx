import { LogOut } from 'lucide-react';
import { useRouter } from '@/lib/navigation';
import { useTranslations } from 'use-intl';
import { useCallback } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { routes } from '@/lib/routes';

import { useSignOut } from '../../hooks/use-auth-actions';

export type SignOutButtonProps = Pick<ButtonProps, 'variant' | 'size'>;

/** Wylogowanie: konczy sesje w API, odswieza dane serwerowe i prowadzi do logowania. */
export function SignOutButton({ variant = 'ghost', size = 'sm' }: SignOutButtonProps) {
  const t = useTranslations('auth.menu');
  const router = useRouter();
  const { mutate, isPending } = useSignOut();
  const signOut = useCallback(() => {
    mutate(undefined, {
      onSuccess: () => {
        router.push(routes.signIn());
        router.refresh();
      },
    });
  }, [mutate, router]);

  return (
    <Button variant={variant} size={size} onClick={signOut} disabled={isPending}>
      <LogOut aria-hidden="true" />
      {isPending ? t('signingOut') : t('signOut')}
    </Button>
  );
}
