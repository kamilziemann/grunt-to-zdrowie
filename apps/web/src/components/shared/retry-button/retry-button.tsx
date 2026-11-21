import { RefreshCw } from 'lucide-react';
import { useRouter } from '@/lib/navigation';
import { useTranslations } from 'use-intl';
import { useCallback, useTransition } from 'react';

import { Button } from '@/components/ui/button';

/** "Sprobuj ponownie" dla stron serwerowych: odswieza trase (loadery wykonuja sie od nowa), bez pelnego przeladowania. */
export function RetryButton({ label }: { label?: string }) {
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  return (
    <Button variant="outline" size="sm" onClick={retry} disabled={pending}>
      <RefreshCw className={pending ? 'animate-spin' : undefined} /> {label ?? t('tryAgain')}
    </Button>
  );
}
