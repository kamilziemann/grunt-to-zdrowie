import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export interface ChartCardProps {
  /** pytanie rolnika, np. "Ile wody maja teraz rosliny?" */
  title: string;
  /** jedno zdanie "co z tego wynika" */
  answer: ReactNode;
  /** skad dane (drobnym drukiem pod zdaniem) */
  source?: string;
  /** opis wykresu dla czytnika ekranu - liczby, ktore widac na rysunku */
  description?: string;
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/**
 * Karta wykresu "Pogodynki": tytul-pytanie, rysunek, zdanie odpowiedzi i zrodlo. Rysunek jest ukryty przed
 * czytnikiem ekranu (`aria-hidden` w samych wykresach), a jego tresc niesie `description`. Na wydruku karta sie
 * nie dzieli.
 */
export function ChartCard({
  title,
  answer,
  source,
  description,
  children,
  className,
  'data-testid': testId,
}: ChartCardProps) {
  const id = useId();

  return (
    <figure
      aria-labelledby={`${id}-title`}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-card sm:p-6 print:break-inside-avoid print:rounded-lg print:p-4 print:shadow-none',
        className,
      )}
      data-testid={testId}
    >
      <h3 id={`${id}-title`} className="text-xl leading-snug font-semibold text-balance print:text-lg">
        {title}
      </h3>
      {description && <p className="sr-only">{description}</p>}
      {children}
      <figcaption className="mt-auto flex flex-col gap-1.5 border-t pt-3">
        <span className="text-lg leading-snug font-medium text-pretty print:text-base">{answer}</span>
        {source && <span className="text-base text-muted-foreground print:text-sm">{source}</span>}
      </figcaption>
    </figure>
  );
}
