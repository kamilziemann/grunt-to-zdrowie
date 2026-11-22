import type { ProblemDetails } from '@app/contracts';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'use-intl';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { problemMessage } from '@/lib/problems';

export interface ProblemAlertProps {
  problem: ProblemDetails;
  /** naglowek; domyslnie komunikat dla kodu */
  title?: string;
  /** komunikat zamiast ogolnego dla kodu (ekran wie lepiej, co sie stalo, np. "nie ma takiej dzialki") */
  message?: string;
  /** akcje, np. przycisk "Spróbuj ponownie" */
  children?: ReactNode;
  className?: string;
}

/**
 * Blad z API dla uzytkownika: komunikat w jezyku interfejsu wg `code`, lista `issues`, detail techniczny zwiniety.
 * Gdy ekran podaje wlasny komunikat (`message`), lista `issues` (teksty walidacji API, po angielsku) jest tylko w
 * zwinietych szczegolach - rolnik widzi jedno zdanie po polsku.
 */
export function ProblemAlert({ problem, title, message: custom, children, className }: ProblemAlertProps) {
  const t = useTranslations('problems');
  const message = custom ?? problemMessage(t, problem.code);

  return (
    <Alert variant="destructive" className={className} data-problem-code={problem.code}>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{title ?? message}</AlertTitle>
      <AlertDescription>
        {title && <p>{message}</p>}
        {!custom && problem.issues && problem.issues.length > 0 && (
          <ul className="list-disc pl-4">
            {problem.issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>
                {issue.path ? <code className="font-mono text-xs">{issue.path}</code> : null}
                {issue.path ? ' – ' : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {problem.detail && (
          <details className="text-xs">
            <summary className="cursor-pointer">{t('technicalDetails')}</summary>
            <p className="mt-1 font-mono break-all">
              {problem.status} {problem.code}: {problem.detail}
              {problem.requestId ? ` (requestId: ${problem.requestId})` : ''}
            </p>
          </details>
        )}
        {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
      </AlertDescription>
    </Alert>
  );
}
