// Prymityw UI (shadcn): pole wieloliniowe o tym samym wygladzie i stanach co `Input` (fokus,
// `aria-invalid`, disabled); zmiana stylu pola = zmiana w obu plikach.
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-2xl border-2 border-input bg-card px-4 py-3 text-base transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/70 focus-visible:border-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
