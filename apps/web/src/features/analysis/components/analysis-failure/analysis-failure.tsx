import type { ProblemDetails } from '@app/contracts';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { ProblemAlert } from '@/components/shared/problem-alert';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

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

  return (
    <ProblemAlert problem={problem} title={t('title')} message={message} className="text-base">
      <Button size="xl" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        {t('retry')}
      </Button>
      <Button asChild size="xl" variant="outline">
        <Link href={changeHref}>{t('change')}</Link>
      </Button>
    </ProblemAlert>
  );
}
