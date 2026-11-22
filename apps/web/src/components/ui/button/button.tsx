// Prymityw UI (shadcn): przycisk z wariantami `cva`, stanem ladowania (spinner, `aria-busy`) i `asChild`
// dla linkow. Ksztalt pigulki, kolory z tokenow semantycznych (zmieniaja sie z motywem i w `surface-panel`).
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-base font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** jedno glowne dzialanie na ekranie: grafit (w ciemnym motywie i w panelu - mieta) */
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        /** jasna mieta z obwodka ("Nie znam numeru - pokaz mape") */
        secondary:
          'border border-secondary-border bg-secondary text-secondary-foreground hover:border-foreground/40',
        outline: 'border-2 border-input bg-transparent hover:border-foreground hover:bg-muted/60',
        ghost: 'hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'h-auto px-0 text-foreground underline underline-offset-4 hover:decoration-2',
        /** mietowe wypelnienie z ciemnym tekstem (glowny przycisk na ciemnym panelu) */
        accent: 'bg-accent font-semibold text-accent-foreground hover:bg-accent/85',
      },
      size: {
        /** cel dotykowy min. 48 px (notatki projektanta: przyciski 48-56 px) */
        default: 'h-12 px-5',
        /** drugorzedne akcje w tekscie i na liscie (min. 44 px) */
        sm: 'h-11 gap-1.5 px-4 text-sm',
        lg: 'h-12 px-6',
        /** glowne akcje ekranu (56 px, tekst 19 px) */
        xl: 'h-14 px-6 text-lg',
        icon: 'size-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** stan ladowania: blokuje przycisk i pokazuje spinner (aria-busy) */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  // asChild: Slot wymaga jednego dziecka, wiec bez spinnera i bez `disabled` (nie dotyczy linkow).
  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
