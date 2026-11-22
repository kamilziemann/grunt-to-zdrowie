import { ChevronDown, FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

export interface ReportSectionProps {
  /** kotwica sekcji (`/raport?...#przyczyny`) i podstawa id naglowka */
  id: string;
  /** numer w kolejnosci raportu (ekran i wydruk maja te sama kolejnosc) */
  number: number;
  title: string;
  /** czesc liczona jeszcze regulami przykladowymi (`meta.sampleParts`) - znacznik pod naglowkiem */
  sample?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Sekcja raportu: numerowany naglowek h2 i tresc. Na wydruku zaczyna sie od nowej linii bez urwanego naglowka.
 * Czesc z regul przykladowych ma pod naglowkiem znacznik i zdanie, ze to podglad (zostaje na wydruku).
 */
export function ReportSection({
  id,
  number,
  title,
  sample = false,
  children,
  className,
}: ReportSectionProps) {
  const t = useTranslations('report.sample');

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('flex scroll-mt-20 flex-col gap-4 print:block print:space-y-4', className)}
      data-report-section={id}
    >
      <h2
        id={`${id}-title`}
        className="flex items-baseline gap-3 text-2xl font-semibold print:break-after-avoid print:text-xl"
      >
        <span aria-hidden="true" className="text-primary tabular-nums">
          {number}.
        </span>
        {title}
      </h2>
      {sample && (
        <p
          className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-lg border border-dashed border-warning bg-warning/10 px-3 py-2 text-sm print:break-inside-avoid"
          data-testid="sample-part"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <FlaskConical aria-hidden="true" className="size-4" />
            {t('sectionBadge')}
          </span>
          <span>{t('sectionNote')}</span>
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * Rozwijane szczegoly techniczne (dla doradcy): pierwsza linia raportu mowi jezykiem rolnika, liczby i skroty sa
 * tutaj. Przed wydrukiem `ReportView` otwiera wszystkie, zeby PDF mial komplet informacji.
 */
export function ReportDetails({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border bg-card print:border-0 print:bg-transparent">
      <summary className="flex min-h-11 print:break-after-avoid cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-base font-medium select-none [&::-webkit-details-marker]:hidden print:min-h-0 print:px-0">
        {summary}
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180 print:hidden"
        />
      </summary>
      <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm print:border-0 print:px-0">
        {children}
      </div>
    </details>
  );
}
