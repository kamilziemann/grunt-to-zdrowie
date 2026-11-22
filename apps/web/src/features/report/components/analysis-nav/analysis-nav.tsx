import { useTranslations } from 'use-intl';

export interface AnalysisNavItem {
  id: string;
  title: string;
}

/**
 * Spis sekcji pelnej analizy: przyklejony pasek kotwic (na telefonie przewijany w poziomie we wlasnym kontenerze).
 * Kotwice zamiast zakladek: dzialaja bez JS, da sie je wyslac (`#przyczyny`), a na wydruku tresc idzie po kolei;
 * kotwica otwiera zwinieta sekcje (`ReportSection`).
 */
export function AnalysisNav({ items }: { items: readonly AnalysisNavItem[] }) {
  const t = useTranslations('report.view');

  return (
    <nav
      aria-label={t('sections')}
      className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-2 print:hidden"
      data-testid="analysis-nav"
    >
      <ol className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {items.map((item, index) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-base font-medium whitespace-nowrap hover:bg-muted"
            >
              <span aria-hidden="true" className="text-primary tabular-nums">
                {index + 1}
              </span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
