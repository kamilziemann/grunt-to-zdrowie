import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'use-intl';

import { Link, useRouter } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

const STORAGE_KEY = 'gtz-report-view';

export interface ReportViewMode {
  /** widok szczegolowy (`?widok=szczegoly`) */
  detailed: boolean;
  /** ten sam raport w widoku prostym i szczegolowym */
  simpleHref: AppHref;
  detailedHref: AppHref;
  /** szczegoly zapisane w adresie - link dla doradcy wygrywa z zapamietanym wyborem */
  explicit: boolean;
}

function remember(value: 'simple' | 'detailed') {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // tryb prywatny albo zablokowana pamiec - przelacznik dziala dalej, tylko bez zapamietania
  }
}

/**
 * Przelacznik "Prosto / Szczegolowo": dwa linki (dzialaja bez JS i da sie je wyslac), wybor zapamietany
 * w przegladarce. Raport otwarty bez parametru `widok` wraca do ostatnio wybranego poziomu.
 */
export function ViewSwitch({ mode, className }: { mode: ReportViewMode; className?: string }) {
  const t = useTranslations('report.view');
  const router = useRouter();
  const { detailed, detailedHref, explicit } = mode;
  // tylko przy otwarciu raportu - pozniej decyduje klikniecie
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    if (explicit || detailed) return;
    let stored: string | null = null;

    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (stored === 'detailed') router.replace(detailedHref);
  }, [explicit, detailed, detailedHref, router]);

  const chooseSimple = useCallback(() => remember('simple'), []);
  const chooseDetailed = useCallback(() => remember('detailed'), []);
  const item =
    'flex min-h-12 items-center justify-center rounded-full px-5 text-base font-semibold transition-colors duration-150';

  return (
    <nav aria-label={t('label')} className={cn('print:hidden', className)} data-testid="view-switch">
      <ul className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        <li>
          <Link
            href={mode.simpleHref}
            aria-current={detailed ? undefined : 'true'}
            onClick={chooseSimple}
            className={cn(
              item,
              detailed ? 'text-muted-foreground hover:text-foreground' : 'bg-card text-foreground shadow-sm',
            )}
            replace
            scroll={false}
          >
            {t('simple')}
          </Link>
        </li>
        <li>
          <Link
            href={mode.detailedHref}
            aria-current={detailed ? 'true' : undefined}
            onClick={chooseDetailed}
            className={cn(
              item,
              detailed ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            replace
            scroll={false}
          >
            {t('detailed')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
