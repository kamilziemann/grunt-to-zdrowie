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
 * Czekanie na analize (makieta "liczenie"): ciemny panel ze stoperem w sekundach i lista zrodel, ktore serwer
 * naprawde pobiera. API nie ma strumienia postepu, a zrodla ida rownoczesnie - kazde ma ten sam stan "pobieram"
 * (bez udawanych procentow i krokow odhaczanych zegarem). Po kilkunastu sekundach mowimy wprost, ze ktores zrodlo
 * jest wolniejsze; przekroczony czas konczy zapytanie bledem (`ANALYSIS_TIMEOUT_MS`) z "Sprobuj ponownie". Wynik
 * pokazuje sie sam, gdy przyjdzie.
 */
export function AnalysisProgress({ className }: { className?: string }) {
  const t = useTranslations('analysis.progress');
  const seconds = useElapsedSeconds();
  const slow = seconds >= SLOW_AFTER_SECONDS;

  return (
    <section
      aria-labelledby="analysis-progress-title"
      aria-busy="true"
      className={cn('surface-panel flex flex-col gap-6 rounded-2xl p-5 sm:p-7', className)}
      data-testid="analysis-progress"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-2">
          <h2 id="analysis-progress-title" className="text-2xl font-medium tracking-tight sm:text-3xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground">{t('hint')}</p>
        </div>
        <p className="flex flex-col items-start sm:items-end">
          <span className="text-sm text-muted-foreground">{t('stopwatch')}</span>
          <span className="text-4xl font-semibold text-accent tabular-nums" data-testid="analysis-stopwatch">
            {t('seconds', { seconds })}
          </span>
        </p>
      </div>
      <ul aria-label={t('listLabel')} className="flex flex-col gap-3">
        {ANALYSIS_SOURCES.map((source) => (
          <li key={source} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-accent"
            >
              <LoaderCircle className="size-4 text-accent motion-safe:animate-spin" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg first-letter:uppercase">{t(`sources.${source}`)}</span>
              <span className="text-sm text-muted-foreground">
                {t(`origins.${source}`)} · {t('fetching')}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-muted-foreground tabular-nums" data-slow={slow || undefined}>
        {slow ? t('slow', { seconds }) : t('elapsed', { seconds })}
      </p>
    </section>
  );
}
