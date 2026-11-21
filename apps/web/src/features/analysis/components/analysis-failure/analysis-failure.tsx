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
}

/**
 * Analiza sie nie udala: komunikat wg kodu bledu (np. dzialki nie ma w ewidencji, GUGiK nie odpowiada, zla data),
 * ponowienie tego samego zapytania i powrot do formularza.
 */
export function AnalysisFailure({ problem, onRetry, changeHref }: AnalysisFailureProps) {
  const t = useTranslations('analysis.error');

  return (
    <ProblemAlert problem={problem} title={t('title')} className="text-base">
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
