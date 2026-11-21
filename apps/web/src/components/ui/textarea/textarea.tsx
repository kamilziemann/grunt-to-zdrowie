// Prymityw UI (shadcn): pole wieloliniowe o tym samym wygladzie i stanach co `Input` (fokus,
// `aria-invalid`, disabled); zmiana stylu pola = zmiana w obu plikach.
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
