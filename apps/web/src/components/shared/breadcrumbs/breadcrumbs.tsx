import { ChevronRight } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';
import { type AppHref } from '@/lib/routes';

export interface BreadcrumbItem {
  label: string;
  /** brak = biezaca strona (ostatni element, bez linku) */
  href?: AppHref;
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  className?: string;
}

/** Sciezka nad naglowkiem strony (Dzialki → dzialka). Ostatni element = biezaca strona. */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const t = useTranslations('nav');

  if (items.length === 0) return null;

  return (
    <nav aria-label={t('breadcrumbs')} className={cn('text-sm text-muted-foreground', className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={`${item.label}-${item.href ?? 'here'}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="max-w-64 truncate hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="max-w-80 truncate text-foreground/80"
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
