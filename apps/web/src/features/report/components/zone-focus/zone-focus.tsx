// Wspolne podswietlenie miejsca na polu w raporcie: zalecenie albo pozycja listy miejsc wybiera strefe, szkic i mapa
// na zdjeciu lotniczym ja wyrozniaja (i odwrotnie - klikniecie strefy wyroznia zalecenia, ktore jej dotycza).
// Wybor (`selected`) trwa do drugiego klikniecia, Escape albo klikniecia w tlo; najechanie i fokus tylko podgladaja
// (`active` = podglad albo wybor). Bez dostawcy (testy pojedynczych komponentow) podswietlanie po prostu nie dziala.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface ZoneFocus {
  /** miejsce wyroznione teraz: podgladane (najechanie, fokus) albo wybrane */
  active: string | null;
  /** miejsce wybrane kliknieciem (stan `aria-pressed`) */
  selected: string | null;
  /** podglad miejsca przy najechaniu albo fokusie; null konczy podglad */
  preview: (zoneId: string | null) => void;
  /** klikniecie miejsca: wybiera je, a ponowne klikniecie tego samego miejsca zdejmuje wybor */
  toggle: (zoneId: string) => void;
  /** zdejmuje wybor (Escape, klikniecie w tlo szkicu albo mapy) */
  clear: () => void;
  /** jak `toggle`, a po wyborze pokazuje szkic z miejscem (przewija do niego, gdy jest poza ekranem) */
  reveal: (zoneId: string) => void;
  /** element ze szkicem - cel przewiniecia */
  sketchRef: (element: HTMLElement | null) => void;
}

const noop = () => undefined;

const ZoneFocusContext = createContext<ZoneFocus>({
  active: null,
  selected: null,
  preview: noop,
  toggle: noop,
  clear: noop,
  reveal: noop,
  sketchRef: noop,
});

export function ZoneFocusProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const sketch = useRef<HTMLElement | null>(null);
  const sketchRef = useCallback((element: HTMLElement | null) => {
    sketch.current = element;
  }, []);
  // klikniecie konczy podglad - inaczej po odznaczeniu miejsce pod kursorem dalej byloby wyroznione
  const toggle = useCallback((zoneId: string) => {
    setPreviewed(null);
    setSelected((current) => (current === zoneId ? null : zoneId));
  }, []);
  const clear = useCallback(() => {
    setSelected(null);
    setPreviewed(null);
  }, []);
  const reveal = useCallback(
    (zoneId: string) => {
      setPreviewed(null);

      if (selected === zoneId) {
        setSelected(null);

        return;
      }

      setSelected(zoneId);
      const element = sketch.current;

      if (!element) return;
      const box = element.getBoundingClientRect();

      if (box.top < 0 || box.bottom > window.innerHeight) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      }
    },
    [selected],
  );

  // Escape zdejmuje wybor z kazdego miejsca strony (fokus moze stac na przycisku zalecenia)
  useEffect(() => {
    if (selected === null) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };

    document.addEventListener('keydown', onKey);

    return () => document.removeEventListener('keydown', onKey);
  }, [selected, clear]);

  const value = useMemo(
    () => ({
      active: previewed ?? selected,
      selected,
      preview: setPreviewed,
      toggle,
      clear,
      reveal,
      sketchRef,
    }),
    [previewed, selected, toggle, clear, reveal, sketchRef],
  );

  return <ZoneFocusContext value={value}>{children}</ZoneFocusContext>;
}

export function useZoneFocus(): ZoneFocus {
  return use(ZoneFocusContext);
}
