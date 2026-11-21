import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** referencja do ikony (nie element JSX) - np. icon={Puzzle} */
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
  /** element tytulu: `h1`, gdy pusty stan jest cala strona (np. 404 - WCAG 2.4.6 wymaga naglowka strony) */
  titleAs?: 'p' | 'h1' | 'h2';
}

/** Pusty stan listy albo widoku: tytul, opcjonalny opis i ikona, a w `children` akcje (np. „Dodaj”). */
export function EmptyState({
  title,
  description,
  icon: Icon,
  children,
  className,
  titleAs: Title = 'p',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && <Icon className="size-8 text-muted-foreground" aria-hidden="true" />}
      <div className="flex flex-col gap-1">
        <Title className="m-0 text-base font-medium">{title}</Title>
        {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
