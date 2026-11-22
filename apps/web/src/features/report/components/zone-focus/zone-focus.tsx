// Wspolne podswietlenie miejsca na polu w raporcie: zalecenie albo pozycja listy miejsc ustawia aktywna strefe, szkic
// ja wyroznia (i odwrotnie - klikniecie strefy na szkicu wyroznia zalecenia, ktore jej dotycza). Bez dostawcy (testy
// pojedynczych komponentow) podswietlanie po prostu nie dziala.
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

interface ZoneFocus {
  active: string | null;
  setActive: (zoneId: string | null) => void;
  /** pokazuje szkic z wyroznionym miejscem (przewija do niego, gdy jest poza ekranem) */
  reveal: (zoneId: string) => void;
  /** element ze szkicem - cel przewiniecia */
  sketchRef: (element: HTMLElement | null) => void;
}

const noop = () => undefined;

const ZoneFocusContext = createContext<ZoneFocus>({
  active: null,
  setActive: noop,
  reveal: noop,
  sketchRef: noop,
});

export function ZoneFocusProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const sketch = useRef<HTMLElement | null>(null);
  const sketchRef = useCallback((element: HTMLElement | null) => {
    sketch.current = element;
  }, []);
  const reveal = useCallback((zoneId: string) => {
    setActive(zoneId);
    const element = sketch.current;

    if (!element) return;
    const box = element.getBoundingClientRect();

    if (box.top < 0 || box.bottom > window.innerHeight) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    }
  }, []);
  const value = useMemo(() => ({ active, setActive, reveal, sketchRef }), [active, reveal, sketchRef]);

  return <ZoneFocusContext value={value}>{children}</ZoneFocusContext>;
}

export function useZoneFocus(): ZoneFocus {
  return use(ZoneFocusContext);
}
