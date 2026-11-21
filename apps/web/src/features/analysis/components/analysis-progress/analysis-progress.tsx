import { Check, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { useElapsedSeconds } from '../../hooks/use-elapsed-seconds';

export type AnalysisStep = 'parcel' | 'weather' | 'soil' | 'water' | 'satellite' | 'balance';

/** Kroki i sekunda, od ktorej krok uchodzi za biezacy (szacunek z atrap i pomiarow zrodel, nie prawdziwy postep). */
export const ANALYSIS_STEPS: readonly { step: AnalysisStep; startsAt: number }[] = [
  { step: 'parcel', startsAt: 0 },
  { step: 'weather', startsAt: 2 },
  { step: 'soil', startsAt: 5 },
  { step: 'water', startsAt: 8 },
  { step: 'satellite', startsAt: 11 },
  { step: 'balance', startsAt: 15 },
];

/** Po tylu sekundach mowimy wprost, ze zrodla odpowiadaja wolniej (cel zadania: analiza do 30 s). */
export const SLOW_AFTER_SECONDS = 30;

/** Indeks biezacego kroku po `seconds` sekundach (ostatni krok trwa, az przyjdzie raport). */
export function activeStepIndex(seconds: number): number {
  return ANALYSIS_STEPS.reduce((active, { startsAt }, index) => (seconds >= startsAt ? index : active), 0);
}

/**
 * Postep analizy krok po kroku. API nie ma strumienia postepu, wiec kroki przelaczaja sie po czasie; biezacy krok
 * jest ogloszony czytnikom ekranu (`aria-live`), a lista mowi, co juz zrobione.
 */
export function AnalysisProgress({ className }: { className?: string }) {
  const t = useTranslations('analysis.progress');
  const seconds = useElapsedSeconds();
  const active = activeStepIndex(seconds);
  const current = ANALYSIS_STEPS[active]?.step ?? 'parcel';

  return (
    <section
      aria-labelledby="analysis-progress-title"
      aria-busy="true"
      className={cn('flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6', className)}
      data-testid="analysis-progress"
    >
      <div className="flex flex-col gap-1">
        <h2 id="analysis-progress-title" className="text-2xl font-semibold">
          {t('title')}
        </h2>
        <p className="text-base text-muted-foreground">{t('hint')}</p>
      </div>
      <p aria-live="polite" className="sr-only">
        {t(`steps.${current}`)}
      </p>
      <ol aria-label={t('listLabel')} className="flex flex-col gap-3">
        {ANALYSIS_STEPS.map(({ step }, index) => {
          const state = index < active ? 'done' : index === active ? 'active' : 'pending';

          return (
            <li
              key={step}
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 text-base transition-colors duration-200',
                state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                state === 'active' && 'font-semibold',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border',
                  state === 'done' && 'border-primary bg-primary text-primary-foreground',
                  state === 'active' && 'border-primary text-primary',
                  state === 'pending' && 'border-border',
                )}
              >
                {state === 'done' && <Check className="size-4" />}
                {state === 'active' && <LoaderCircle className="size-4 animate-spin" />}
              </span>
              <span>
                {t(`steps.${step}`)}
                <span className="sr-only">, {t(`state.${state}`)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground tabular-nums">
        {seconds >= SLOW_AFTER_SECONDS ? t('slow') : t('elapsed', { seconds })}
      </p>
    </section>
  );
}
