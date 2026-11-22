import type { ProblemDetails } from '@app/contracts';
import { Map as MapIcon, RefreshCw } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { ProblemAlert } from '@/components/shared/problem-alert';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { routes, type AppHref } from '@/lib/routes';

export interface AnalysisFailureProps {
  problem: ProblemDetails;
  onRetry: () => void;
  /** powrot do formularza z tymi samymi dzialkami */
  changeHref: AppHref;
  /** przegladarka przestala czekac (limit czasu analizy) */
  timedOut?: boolean;
}

const OWN_MESSAGES = new Set(['upstream_failed', 'not_found', 'validation_failed'] as const);

function hasOwnMessage(code: string): code is 'upstream_failed' | 'not_found' | 'validation_failed' {
  return (OWN_MESSAGES as ReadonlySet<string>).has(code);
}

/**
 * Analiza sie nie udala: komunikat jezykiem rolnika wg kodu bledu (dzialki nie ma w ewidencji, zrodlo nie odpowiada,
 * zly dzien) albo przekroczonego czasu, ponowienie tego samego zapytania i powrot do formularza. Szczegoly
 * techniczne zostaja zwiniete.
 */
export function AnalysisFailure({ problem, onRetry, changeHref, timedOut = false }: AnalysisFailureProps) {
  const t = useTranslations('analysis.error');
  const message = timedOut
    ? t('timeout')
    : hasOwnMessage(problem.code)
      ? t(`messages.${problem.code}`)
      : undefined;
  const notFound = !timedOut && problem.code === 'not_found';
  // zly link (dzien poza zakresem): ponowienie da ten sam blad - zostaje zmiana uprawy lub daty
  const invalid = !timedOut && problem.code === 'validation_failed';

  return (
    <ProblemAlert problem={problem} title={t('title')} message={message} className="text-base">
      {/* brak dzialki: ponowienie nic nie da - droga do innego numeru albo mapy */}
      {notFound ? (
        <>
          <Button asChild size="xl">
            <Link href={routes.home()}>{t('otherNumber')}</Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href={routes.map()}>
              <MapIcon aria-hidden="true" />
              {t('showMap')}
            </Link>
          </Button>
        </>
      ) : (
        <>
          {!invalid && (
            <Button size="xl" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              {t('retry')}
            </Button>
          )}
          <Button asChild size="xl" variant={invalid ? 'default' : 'outline'}>
            <Link href={changeHref}>{t('change')}</Link>
          </Button>
        </>
      )}
    </ProblemAlert>
  );
}
