import { Check } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

export type ParcelStep = 'find' | 'check' | 'analyze';

const STEPS: readonly ParcelStep[] = ['find', 'check', 'analyze'];

/** Sciezka "znajdz -> sprawdz -> analizuj": rolnik widzi, gdzie jest i co bedzie dalej (mapa to nie cel sam w sobie). */
export function StepsHeader({ current, className }: { current: ParcelStep; className?: string }) {
  const t = useTranslations('parcels.steps');
  const currentIndex = STEPS.indexOf(current);

  return (
    <ol aria-label={t('label')} className={cn('flex items-center gap-2 text-sm', className)}>
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 font-medium',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                active && 'bg-accent text-accent-foreground',
                done && 'bg-primary/15 text-primary',
                !active && !done && 'bg-muted text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            {t(step)}
            {index < STEPS.length - 1 && <span aria-hidden="true" className="ml-1 h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
