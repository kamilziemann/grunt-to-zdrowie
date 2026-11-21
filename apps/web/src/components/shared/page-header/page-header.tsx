import type { ReactNode } from 'react';

import { Breadcrumbs, type BreadcrumbItem } from '@/components/shared/breadcrumbs';
import { cn } from '@/lib/utils/cn';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** sciezka nad tytulem (np. Dzialki → dzialka); ostatni element = ta strona */
  breadcrumbs?: readonly BreadcrumbItem[];
  /** odznaki obok tytulu */
  meta?: ReactNode;
  /** akcje glowne po prawej (przyciski, linki); najwazniejsza pierwsza */
  children?: ReactNode;
  className?: string;
}

/** Jednolity naglowek kazdej strony aplikacji: sciezka, tytul, opis i akcje. */
export function PageHeader({ title, description, breadcrumbs, meta, children, className }: PageHeaderProps) {
  const hasActions = Boolean(children);

  return (
    <header className={cn('flex flex-col gap-2', className)} data-testid="page-header">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl leading-tight font-bold text-primary">{title}</h1>
            {meta}
          </div>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {hasActions && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
