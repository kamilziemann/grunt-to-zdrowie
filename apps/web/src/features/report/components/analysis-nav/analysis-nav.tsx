import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslations } from 'use-intl';

export interface AnalysisNavItem {
  id: string;
  title: string;
}

/**
 * Wysokosc przyklejonego naglowka aplikacji (zmienia sie z szerokoscia ekranu i lamaniem menu) - spis sekcji
 * przykleja sie pod nim, a nie pod spodem. Bez naglowka (testy, wydruk) - 0.
 */
function useStickyHeaderHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header.sticky');

    if (!header) return undefined;
    const measure = () => setHeight(Math.ceil(header.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  return height;
}

/**
 * Spis sekcji pelnej analizy: przyklejony pasek kotwic (na telefonie przewijany w poziomie we wlasnym kontenerze).
 * Kotwice zamiast zakladek: dzialaja bez JS, da sie je wyslac (`#przyczyny`), a na wydruku tresc idzie po kolei;
 * kotwica otwiera zwinieta sekcje (`ReportSection`). Przykleja sie pod przyklejonym naglowkiem aplikacji.
 */
export function AnalysisNav({ items }: { items: readonly AnalysisNavItem[] }) {
  const t = useTranslations('report.view');
  const top = useStickyHeaderHeight();
  const style = useMemo((): CSSProperties => ({ top: `${String(top)}px` }), [top]);

  return (
    <nav
      aria-label={t('sections')}
      style={style}
      className="sticky z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-2 print:hidden"
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
