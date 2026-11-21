import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { useTranslations } from 'use-intl';

import { ProblemAlert } from '@/components/shared/problem-alert';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/lib/navigation';
import { toProblem } from '@/lib/problems';
import { routes } from '@/lib/routes';
import { reportClientError } from '@/lib/telemetry';

/**
 * Granica bledow strony aplikacji: komunikat wg kodu bledu i „Sprobuj ponownie”, ktore czysci bledy zapytan i uruchamia
 * loadery trasy od nowa. Blad trafia do telemetrii z traceId odslony.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const t = useTranslations();
  const router = useRouter();
  const queryErrors = useQueryErrorResetBoundary();
  const retry = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    queryErrors.reset();
    reportClientError(error, 'boundary');
  }, [error, queryErrors]);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <ProblemAlert problem={toProblem(error)} title={t('errors.pageTitle')}>
        <Button variant="outline" size="sm" onClick={retry}>
          {t('common.tryAgain')}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={routes.home()}>{t('errors.backHome')}</Link>
        </Button>
      </ProblemAlert>
    </div>
  );
}
