// Prymityw UI (shadcn): jednoliniowe pole tekstowe (pigulka, 48 px, tekst 17 px) na tokenach semantycznych; blad pola to `aria-invalid`
// (obwodka `destructive`), fokus to pierscien `ring`. Wyglad i stany dzieli z `Textarea`.
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-12 w-full min-w-0 rounded-full border-2 border-input bg-card px-5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/70 focus-visible:border-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
