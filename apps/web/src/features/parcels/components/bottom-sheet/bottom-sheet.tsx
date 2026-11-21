// Panel boczny na komputerze, arkusz wysuwany od dolu na telefonie - jeden element, uklad rozstrzyga CSS (bez
// zgadywania szerokosci ekranu w SSR). Na telefonie arkusz ma stala wysokosc i przesuwa sie transformacja
// (bez przeliczania ukladu przy przeciaganiu); widoczna czesc to `--sheet-h` minus `--sheet-offset`.
// Rodzic musi miec `container-type: size` - wysokosc arkusza liczy sie od niego (jednostka cqh).
// Skladanie: <BottomSheet><BottomSheetBody/>?<BottomSheetFooter/></BottomSheet>.
import { useCallback, useMemo, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export type SheetSnap = 'peek' | 'half' | 'full';

/** Wysokosc widocznej czesci zwinietego arkusza (uchwyt + pole wyszukiwania + pasek akcji). */
export const SHEET_PEEK_REM = 11.5;
/** Jaka czesc arkusza widac w polozeniu posrednim. */
export const SHEET_HALF_FRACTION = 0.55;

const OFFSETS: Record<SheetSnap, string> = {
  peek: `calc(var(--sheet-h) - ${SHEET_PEEK_REM}rem)`,
  half: `calc(var(--sheet-h) * ${1 - SHEET_HALF_FRACTION})`,
  full: '0px',
};

const ORDER: readonly SheetSnap[] = ['peek', 'half', 'full'];
const CLICK_TOLERANCE_PX = 6;

export interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  labels: { expand: string; collapse: string };
  children: ReactNode;
  className?: string;
}

function snapOffsets(height: number): Record<SheetSnap, number> {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  return { peek: height - SHEET_PEEK_REM * rem, half: height * (1 - SHEET_HALF_FRACTION), full: 0 };
}

/** Biezace przesuniecie arkusza w pikselach. Tailwind 4 przesuwa wlasciwoscia `translate` ("0px 336px"), nie `transform`. */
function currentOffset(sheet: HTMLElement): number {
  const [, y] = getComputedStyle(sheet).translate.split(' ');

  return Number.parseFloat(y ?? '0') || 0;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

export function BottomSheet({ snap, onSnapChange, labels, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startOffset: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const style = useMemo(() => ({ '--sheet-offset': OFFSETS[snap] }) as CSSProperties, [snap]);

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

  const onPointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const sheet = sheetRef.current;
    const state = drag.current;

    if (!sheet || !state) return;

    const delta = event.clientY - state.startY;

    if (Math.abs(delta) > CLICK_TOLERANCE_PX) state.moved = true;

    if (!state.moved) return;

    sheet.dataset.dragging = 'true';
    sheet.style.setProperty(
      '--sheet-offset',
      `${clamp(state.startOffset + delta, snapOffsets(sheet.offsetHeight).peek)}px`,
    );
  }, []);

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

      const offsets = snapOffsets(sheet.offsetHeight);
      const current = clamp(state.startOffset + event.clientY - state.startY, offsets.peek);
      const nearest = ORDER.reduce((best, candidate) =>
        Math.abs(offsets[candidate] - current) < Math.abs(offsets[best] - current) ? candidate : best,
      );

      // React przepisze wlasciwosc tylko przy zmianie polozenia, wiec po przeciaganiu ustawiamy ja sami.
      sheet.style.setProperty('--sheet-offset', OFFSETS[nearest]);
      onSnapChange(nearest);
    },
    [onSnapChange],
  );

  // Dotkniecie albo klawiatura: zwiniety -> posredni -> pelny -> posredni.
  const onHandleClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;

      return;
    }

    onSnapChange(snap === 'half' ? 'full' : 'half');
  }, [onSnapChange, snap]);

  return (
    <div
      ref={sheetRef}
      data-testid="parcels-panel"
      data-snap={snap}
      style={style}
      className={cn(
        'group/sheet absolute z-10 flex flex-col bg-card text-card-foreground shadow-lg',
        'max-md:inset-x-0 max-md:bottom-0 max-md:h-(--sheet-h) max-md:translate-y-(--sheet-offset) max-md:rounded-t-2xl max-md:border-t max-md:[--sheet-h:calc(100cqh-0.75rem)]',
        'max-md:transition-transform max-md:duration-(--duration-slow) max-md:ease-(--ease-out) max-md:data-dragging:transition-none',
        'md:top-3 md:bottom-3 md:left-3 md:w-100 md:rounded-xl md:border',
        className,
      )}
    >
      <button
        type="button"
        aria-label={snap === 'full' ? labels.collapse : labels.expand}
        aria-expanded={snap !== 'peek'}
        onClick={onHandleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="flex h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-2xl text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:hidden"
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border" />
      </button>
      <div className="flex min-h-0 flex-col max-md:h-[calc(var(--sheet-h)-var(--sheet-offset)-2.75rem)] md:flex-1">
        {children}
      </div>
    </div>
  );
}

/** Przewijana tresc arkusza; zwiniety arkusz pokazuje tylko jej poczatek (pole wyszukiwania), bez przewijania. */
export function BottomSheetBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-md:group-data-[snap=peek]/sheet:overflow-hidden">
      {children}
    </div>
  );
}

/** Pasek zawsze widoczny na dole arkusza: glowna akcja biezacego kroku. */
export function BottomSheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
