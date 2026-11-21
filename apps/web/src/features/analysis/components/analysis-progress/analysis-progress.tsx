import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { useElapsedSeconds } from '../../hooks/use-elapsed-seconds';

export type AnalysisSource = 'parcel' | 'weather' | 'soil' | 'water' | 'satellite';

/** Co serwer pobiera - rownoczesnie, wiec bez kolejnosci i bez "zrobione" odhaczanego po czasie. */
export const ANALYSIS_SOURCES: readonly AnalysisSource[] = [
  'parcel',
  'weather',
  'soil',
  'water',
  'satellite',
];

/** Zwykle analiza trwa 2-10 s; po tylu sekundach mowimy wprost, ze ktores zrodlo odpowiada wolniej. */
export const SLOW_AFTER_SECONDS = 15;

/**
 * Czekanie na analize: API nie ma strumienia postepu, a zrodla pobiera rownoczesnie - pokazujemy uczciwie, co jest
 * pobierane (bez udawanych procentow i krokow odhaczanych zegarem), ile sekund minelo i kiedy zrodla sa wolniejsze.
 * Przekroczony czas konczy zapytanie bledem (`ANALYSIS_TIMEOUT_MS`), wtedy ekran pokazuje "Sprobuj ponownie".
 */
export function AnalysisProgress({ className }: { className?: string }) {
  const t = useTranslations('analysis.progress');
  const seconds = useElapsedSeconds();
  const slow = seconds >= SLOW_AFTER_SECONDS;

  return (
    <section
      aria-labelledby="analysis-progress-title"
      aria-busy="true"
      className={cn('flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6', className)}
      data-testid="analysis-progress"
    >
      <div className="flex flex-col gap-1">
        <h2 id="analysis-progress-title" className="flex items-center gap-2 text-2xl font-semibold">
          <LoaderCircle
            aria-hidden="true"
            className="size-6 shrink-0 text-primary motion-safe:animate-spin"
          />
          {t('title')}
        </h2>
        <p className="text-base text-muted-foreground">{t('hint')}</p>
      </div>
      <ul aria-label={t('listLabel')} className="flex flex-col gap-2.5">
        {ANALYSIS_SOURCES.map((source) => (
          <li key={source} className="flex items-start gap-3 text-base">
            <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary/60" />
            {t(`sources.${source}`)}
          </li>
        ))}
      </ul>
      <p
        aria-live="polite"
        className="text-sm text-muted-foreground tabular-nums"
        data-slow={slow || undefined}
      >
        {slow ? t('slow', { seconds }) : t('elapsed', { seconds })}
      </p>
    </section>
  );
}
