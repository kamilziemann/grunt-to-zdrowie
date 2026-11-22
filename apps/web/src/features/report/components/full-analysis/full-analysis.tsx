import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { useRouter } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

/** Kotwica szczegolow (stare linki `#analiza` dalej trafiaja). */
const ANCHOR = 'analiza';

export interface DetailsState {
  /** szczegoly rozwiniete w adresie (`?widok=szczegoly` - stare linki i zapisane raporty) */
  open: boolean;
  /** ten sam raport z rozwinietymi i ze zwinietymi szczegolami */
  openHref: AppHref;
  closedHref: AppHref;
}

/** Element wskazany kotwica w adresie, jesli lezy w szczegolach. */
function hashTarget(container: HTMLElement | null): HTMLElement | null {
  const id = decodeURIComponent(window.location.hash.slice(1));

  if (!id || !container) return null;
  const target = document.getElementById(id);

  return target && container.contains(target) ? target : null;
}

/** Po narysowaniu rozwinietej tresci (dwie klatki: stan, potem uklad). */
function afterRender(run: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(run));
}

function scrollTo(element: HTMLElement) {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

/**
 * Szczegoly raportu na koncu jednej strony: duzy przycisk na cala szerokosc ("Pokaz szczegoly" i jedno zdanie, co
 * tam jest), pod nim pelna analiza. Stan w adresie (`?widok=szczegoly`): stary link otwiera strone z rozwinietymi
 * szczegolami i przewija do nich. Kotwica sekcji (`#przyczyny`, spis sekcji, "Wszystkie zalecenia") rozwija je sama.
 * Tresc jest zawsze w dokumencie - wydruk i PDF maja calosc niezaleznie od stanu na ekranie.
 */
export function FullAnalysis({ state, children }: { state: DetailsState; children: ReactNode }) {
  const t = useTranslations('report.view');
  const router = useRouter();
  const content = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // kotwica do sekcji w szczegolach bez parametru w adresie (`#zrodla`) - rozwija na te wizyte
  const [byHash, setByHash] = useState(false);
  const open = state.open || byHash;
  const { openHref, closedHref } = state;

  const mounted = useRef(false);

  // wejscie na strone: kotwica do sekcji w szczegolach rozwija je i przewija do sekcji, sam parametr (stary link) -
  // na poczatek szczegolow; pozniej link z parametrem i kotwica ("Wszystkie zalecenia") przewija do sekcji
  useEffect(() => {
    const first = !mounted.current;

    mounted.current = true;

    if (!first && !state.open) return;
    const target = hashTarget(content.current);

    if (target) setByHash(true);
    const element = target ?? (first && state.open ? toggleRef.current : null);

    if (element) afterRender(() => scrollTo(element));
  }, [state.open]);

  useEffect(() => {
    const onHash = () => {
      const target = hashTarget(content.current);

      if (!target) return;
      setByHash(true);
      afterRender(() => scrollTo(target));
    };

    window.addEventListener('hashchange', onHash);

    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const toggle = useCallback(() => {
    if (open) setByHash(false);

    router.replace(open ? closedHref : openHref, { scroll: false });
  }, [open, openHref, closedHref, router]);

  return (
    <div className="flex flex-col gap-6 print:block">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={ANCHOR}
        onClick={toggle}
        className="flex min-h-16 w-full scroll-mt-4 items-center justify-between gap-4 rounded-3xl border-2 border-primary/40 bg-card px-5 py-4 text-left shadow-card transition-colors duration-150 hover:border-primary hover:bg-muted/40 sm:px-7 print:hidden"
        data-testid="show-details"
      >
        <span className="flex flex-col gap-1">
          <span className="text-xl font-semibold">{open ? t('hide') : t('show')}</span>
          <span className="text-base text-muted-foreground">{t('note')}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-7 shrink-0 text-primary transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        ref={content}
        id={ANCHOR}
        className={cn('scroll-mt-4 flex-col gap-4 print:block print:space-y-6', open ? 'flex' : 'hidden')}
        data-testid="report-details"
      >
        {children}
      </div>
    </div>
  );
}
