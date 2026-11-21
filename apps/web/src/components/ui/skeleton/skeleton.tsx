// Prymityw UI (shadcn): pulsujacy prostokat w miejscu tresci w stanie ladowania (trasy w trakcie
// ladowania, listy). Pulsuje takze przy `prefers-reduced-motion`, bo sygnalizuje stan (wyjatek w app.css).
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
  );
}
