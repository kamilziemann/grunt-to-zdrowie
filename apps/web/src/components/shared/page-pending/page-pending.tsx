import { useTranslations } from 'use-intl';

import { Skeleton } from '@/components/ui/skeleton';

const SKELETON_KEYS = ['a', 'b', 'c'];

/** Szkielet strony aplikacji (naglowek + kafelki) na czas ladowania danych trasy. */
export function PagePending() {
  const t = useTranslations('common');

  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {SKELETON_KEYS.map((key) => (
          <li key={key}>
            <Skeleton className="h-28 w-full" />
          </li>
        ))}
      </ul>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
