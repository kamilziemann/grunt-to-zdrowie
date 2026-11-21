// Prymityw UI (shadcn): jednoliniowe pole tekstowe na tokenach semantycznych; blad pola to `aria-invalid`
// (obwodka `destructive`), fokus to pierscien `ring`. Wyglad i stany dzieli z `Textarea`.
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
