// Prosty toaster w duchu sonner: kontekst + lista komunikatow znikajacych po kilku sekundach.
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

  const toast = useCallback(
    (input: ToastInput) => {
      counter += 1;
      const id = counter;
      const variant = input.variant ?? 'default';

      setItems((prev) => [...prev, { ...input, id, variant }]);
      const duration = input.duration ?? (variant === 'error' ? 8000 : 5000);

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
  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-full max-w-sm flex-col gap-2"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const t = useTranslations('common');
  const Icon = ICONS[item.variant];
  const close = useCallback(() => onDismiss(item.id), [onDismiss, item.id]);

  return (
    <output
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md animate-in fade-in-0 slide-in-from-bottom-2',
        item.variant === 'error' && 'border-destructive/40',
        item.variant === 'success' && 'border-success/40',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          item.variant === 'error' && 'text-destructive',
          item.variant === 'success' && 'text-success',
          item.variant === 'default' && 'text-primary',
        )}
      />
      <div className="flex-1">
        <p className="font-medium">{item.title}</p>
        {item.description && <p className="mt-0.5 text-muted-foreground">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={t('closeNotification')}
        className="rounded-sm opacity-60 hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </output>
  );
}
