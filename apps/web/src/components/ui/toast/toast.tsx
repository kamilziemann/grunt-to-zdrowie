// Prosty toaster w duchu sonner: kontekst + lista komunikatow znikajacych po kilku sekundach. Jeden region
// `aria-live` w powloce (zawsze w DOM, zeby czytniki ogloszaly nowe wpisy), bez przejmowania fokusu. Na telefonie
// u gory ekranu - na dole stoja przyklejone glowne przyciski, ktorych powiadomienie nie moze zaslonic.
import { CircleCheck, CircleX, Info, X } from 'lucide-react';
import { useTranslations } from 'use-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils/cn';

export type ToastVariant = 'default' | 'success' | 'error';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms; domyslnie 5000, bledy 8000 */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  variant: ToastVariant;
}

export interface ToastApi {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);

    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const toast = useCallback(
    (input: ToastInput) => {
      const variant = input.variant ?? 'default';
      const duration = input.duration ?? (variant === 'error' ? 8000 : 5000);
      // ten sam komunikat drugi raz (np. ponowne "Analizuj" bez uprawy) nie dokleja kopii - tylko wydluza czas
      const same = itemsRef.current.find((item) => item.title === input.title && item.variant === variant);

      if (same) {
        clearTimeout(timers.current.get(same.id));
        timers.current.set(
          same.id,
          setTimeout(() => dismiss(same.id), duration),
        );

        return same.id;
      }

      counter += 1;
      const id = counter;
      const item = { ...input, id, variant };

      itemsRef.current = [...itemsRef.current, item];
      setItems((prev) => [...prev, item]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );

      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;

    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  const value = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);

  if (!ctx) throw new Error('useToast wymaga <ToastProvider> w drzewie komponentow');

  return ctx;
}

const ICONS = { default: Info, success: CircleCheck, error: CircleX } as const;

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const t = useTranslations('common');

  // region jest zawsze w DOM (pusty tez): czytnik oglasza tylko zmiany w regionie, ktory juz istnial
  return (
    <ol
      aria-live="polite"
      aria-label={t('notifications')}
      className="pointer-events-none fixed inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-100 flex flex-col gap-2 md:top-auto md:right-4 md:bottom-4 md:left-auto md:w-full md:max-w-sm"
      data-testid="toasts"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </ol>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const t = useTranslations('common');
  const Icon = ICONS[item.variant];
  const close = useCallback(() => onDismiss(item.id), [onDismiss, item.id]);

  return (
    <li
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover py-1 pr-1 pl-3 text-sm text-popover-foreground shadow-md animate-in fade-in-0 slide-in-from-top-2 motion-reduce:animate-none md:slide-in-from-bottom-2',
        item.variant === 'error' && 'border-destructive/40',
        item.variant === 'success' && 'border-success/40',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-3.5 size-4 shrink-0',
          item.variant === 'error' && 'text-destructive',
          item.variant === 'success' && 'text-success',
          item.variant === 'default' && 'text-primary',
        )}
      />
      <div className="flex-1 py-2.5">
        <p className="font-medium">{item.title}</p>
        {item.description && <p className="mt-0.5 text-muted-foreground">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={t('closeNotification')}
        className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}
