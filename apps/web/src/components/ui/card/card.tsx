// Prymityw UI (shadcn): karta z naglowkiem (`CardTitle` = h3), trescia i stopka na tokenach semantycznych
// (`bg-card`, `shadow-card`); pokazuje ja katalog `/design`.
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-4 rounded-2xl border bg-card py-6 text-card-foreground shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1 px-6', className)} {...props} />;
}

/**
 * Tytul karty. Domyslnie `h2` - karta zwykle lezy tuz pod `h1` strony (axe `heading-order` nie przepuszcza skoku
 * h1 -> h3); karta w sekcji z wlasnym `h2` podaje `as="h3"`.
 */
export function CardTitle({
  className,
  children,
  as: Heading = 'h2',
  ...props
}: ComponentProps<'h2'> & { as?: 'h2' | 'h3' | 'h4' }) {
  return (
    <Heading data-slot="card-title" className={cn('text-xl leading-tight font-medium', className)} {...props}>
      {children}
    </Heading>
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center gap-2 px-6', className)} {...props} />;
}
