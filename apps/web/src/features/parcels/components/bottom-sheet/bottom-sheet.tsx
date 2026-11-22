// Panel boczny na komputerze, arkusz wysuwany od dolu na telefonie - jeden element, uklad rozstrzyga CSS (bez
// zgadywania szerokosci ekranu w SSR). Na telefonie arkusz ma stala wysokosc i przesuwa sie transformacja
// (bez przeliczania ukladu przy przeciaganiu); widoczna czesc to `--sheet-h` minus `--sheet-offset`. Zwiniety arkusz
// pokazuje tylko uchwyt i pasek akcji - jego wysokosc (`--sheet-peek`) mierzymy, bo pasek bywa o linijke wyzszy.
// W pelni rozwiniety arkusz konczy sie pod polem wyszukiwania mapy (4,75 rem od gory): wczesniej wchodzil pod pole,
// ktore przykrywalo uchwyt i nie dalo sie go zwinac dotknieciem. Na niskim ekranie pole stoi obok, wiec arkusz siega gory.
// Rodzic musi miec `container-type: size` - wysokosc arkusza liczy sie od niego (jednostka cqh).
// Skladanie: <BottomSheet><BottomSheetBody/>?<BottomSheetFooter/></BottomSheet>.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

export type SheetSnap = 'peek' | 'half' | 'full';

/** Wysokosc zwinietego arkusza (uchwyt + pasek z jednym przyciskiem), zanim przegladarka ja zmierzy. */
export const SHEET_PEEK_FALLBACK_REM = 7.75;
/** Jaka czesc ekranu mapy zajmuje arkusz w polozeniu posrednim. */
export const SHEET_HALF_FRACTION = 0.55;
/** Telefon poziomo (niski ekran): w polozeniu posrednim wiecej arkusza - inaczej widac tylko pasek krokow. */
export const SHEET_HALF_FRACTION_SHORT = 0.75;
/** Niski ekran - ten sam prog co klasy `[@media(height<30rem)]`. */
const SHORT_SCREEN_QUERY = '(max-height: 30rem)';

/** Udzial ekranu mapy pod arkuszem w polozeniu posrednim (po stronie klienta zalezy od wysokosci ekranu). */
export function sheetHalfFraction(): number {
  return typeof window !== 'undefined' && window.matchMedia(SHORT_SCREEN_QUERY).matches
    ? SHEET_HALF_FRACTION_SHORT
    : SHEET_HALF_FRACTION;
}

const OFFSETS: Record<SheetSnap, string> = {
  peek: 'calc(var(--sheet-h) - var(--sheet-peek))',
  // widoczna czesc w polozeniu posrednim to ulamek wysokosci rodzica (tak liczy ja mapa), nie arkusza
  half: 'calc(var(--sheet-h) - var(--sheet-half, 55cqh))',
  full: '0px',
};

const ORDER: readonly SheetSnap[] = ['peek', 'half', 'full'];
const CLICK_TOLERANCE_PX = 6;

export interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  labels: { expand: string; collapse: string };
  /** zmierzona wysokosc zwinietego arkusza w px (rodzic dopasowuje do niej mape) */
  onPeekChange?: (px: number) => void;
  children: ReactNode;
  className?: string;
}

function snapOffsets(sheet: HTMLElement, peek: number): Record<SheetSnap, number> {
  const height = sheet.offsetHeight;
  const container = sheet.parentElement?.clientHeight ?? height;

  return { peek: height - peek, half: Math.max(0, height - container * sheetHalfFraction()), full: 0 };
}

function fallbackPeek(): number {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  return SHEET_PEEK_FALLBACK_REM * rem;
}

/** Biezace przesuniecie arkusza w pikselach. Tailwind 4 przesuwa wlasciwoscia `translate` ("0px 336px"), nie `transform`. */
function currentOffset(sheet: HTMLElement): number {
  const [, y] = getComputedStyle(sheet).translate.split(' ');

  return Number.parseFloat(y ?? '0') || 0;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

export function BottomSheet({
  snap,
  onSnapChange,
  labels,
  onPeekChange,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [peek, setPeek] = useState<number | null>(null);
  const style = useMemo(
    () =>
      ({
        '--sheet-offset': OFFSETS[snap],
        '--sheet-peek': peek === null ? `${SHEET_PEEK_FALLBACK_REM}rem` : `${peek}px`,
      }) as CSSProperties,
    [snap, peek],
  );

  // zwiniety arkusz = uchwyt + pasek akcji; pasek zmienia wysokosc z krokiem (przycisk sam albo z podpisem)
  useEffect(() => {
    const handle = handleRef.current;
    const footer = sheetRef.current?.querySelector<HTMLElement>('[data-sheet-footer]');
    const measure = () => {
      if (!handle || !footer) return;

      const next = handle.offsetHeight + footer.offsetHeight;

      setPeek(next);
      onPeekChange?.(next);
    };
    const observer = new ResizeObserver(measure);

    if (handle) observer.observe(handle);

    if (footer) observer.observe(footer);

    measure();

    return () => observer.disconnect();
  }, [onPeekChange]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const sheet = sheetRef.current;

    if (!sheet) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = false;
    drag.current = {
      startY: event.clientY,
      startOffset: currentOffset(sheet),
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const sheet = sheetRef.current;
      const state = drag.current;

      if (!sheet || !state) return;

      const delta = event.clientY - state.startY;

      if (Math.abs(delta) > CLICK_TOLERANCE_PX) state.moved = true;

      if (!state.moved) return;

      sheet.dataset.dragging = 'true';
      sheet.style.setProperty(
        '--sheet-offset',
        `${clamp(state.startOffset + delta, snapOffsets(sheet, peek ?? fallbackPeek()).peek)}px`,
      );
    },
    [peek],
  );

  const onPointerEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const sheet = sheetRef.current;
      const state = drag.current;

      drag.current = null;

      // samo dotkniecie (bez ruchu) obsluzy `onClick`
      if (!sheet || !state?.moved) return;

      delete sheet.dataset.dragging;
      // po przeciagnieciu przegladarka wysyla jeszcze `click` - nie moze on przelaczyc polozenia drugi raz
      suppressClick.current = true;

      const offsets = snapOffsets(sheet, peek ?? fallbackPeek());
      const current = clamp(state.startOffset + event.clientY - state.startY, offsets.peek);
      const nearest = ORDER.reduce((best, candidate) =>
        Math.abs(offsets[candidate] - current) < Math.abs(offsets[best] - current) ? candidate : best,
      );

      // React przepisze wlasciwosc tylko przy zmianie polozenia, wiec po przeciaganiu ustawiamy ja sami.
      sheet.style.setProperty('--sheet-offset', OFFSETS[nearest]);
      onSnapChange(nearest);
    },
    [onSnapChange, peek],
  );

  // Dotkniecie albo klawiatura: zwiniety -> posredni -> pelny -> zwiniety (z pelnego wraca sie do mapy).
  const onHandleClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;

      return;
    }

    onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
  }, [onSnapChange, snap]);

  return (
    <div
      ref={sheetRef}
      data-testid="parcels-panel"
      data-snap={snap}
      style={style}
      className={cn(
        'group/sheet absolute z-10 flex flex-col bg-card text-card-foreground shadow-lg',
        'max-lg:inset-x-0 max-lg:bottom-0 max-lg:h-(--sheet-h) max-lg:translate-y-(--sheet-offset) max-lg:rounded-t-2xl max-lg:border-t max-lg:[--sheet-h:calc(100cqh-4.75rem)] max-lg:[@media(height<30rem)]:[--sheet-h:calc(100cqh-0.75rem)]',
        'max-lg:transition-transform max-lg:duration-(--duration-slow) max-lg:ease-(--ease-out) max-lg:data-dragging:transition-none',
        'lg:top-3 lg:bottom-3 lg:left-3 lg:w-100 lg:rounded-xl lg:border',
        className,
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={snap === 'full' ? labels.collapse : labels.expand}
        aria-expanded={snap !== 'peek'}
        onClick={onHandleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="flex h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-2xl text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 lg:hidden"
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border" />
      </button>
      <div className="flex min-h-0 flex-col max-lg:h-[calc(var(--sheet-h)-var(--sheet-offset)-2.75rem)] lg:flex-1">
        {children}
      </div>
    </div>
  );
}

/** Przewijana tresc arkusza; w zwinietym arkuszu na telefonie jej nie widac (i nie da sie do niej przejsc Tabem). */
export function BottomSheetBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-lg:group-data-[snap=peek]/sheet:invisible max-lg:group-data-[snap=peek]/sheet:overflow-hidden">
      {children}
    </div>
  );
}

/** Pasek zawsze widoczny na dole arkusza: glowna akcja biezacego kroku. */
export function BottomSheetFooter({ children }: { children: ReactNode }) {
  return (
    <div
      data-sheet-footer=""
      className="shrink-0 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {children}
    </div>
  );
}
