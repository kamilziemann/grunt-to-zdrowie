import type { WaterReport } from '@app/contracts';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils/cn';

import { byWeight, percentOf } from '../../utils/report-data';
import { causeShare } from '../../utils/report-extras';

/** Najwyzej tyle przyczyn na gorze raportu - reszta w szczegolach. */
const MAX_CAUSES = 4;

/** Znacznik przyczyny: wielkosc kropki rosnie z udzialem (kolor tylko wzmacnia), obok slowo "glowna". */
const DOT = [
  'size-4 bg-data-orange-dark',
  'size-3.5 bg-data-orange-strong',
  'size-3 bg-data-orange',
  'size-3 bg-data-sand',
];

/**
 * "Dlaczego" na gorze raportu: 2-4 przyczyny, kazda tytulem i jednym zdaniem, pierwsza oznaczona jako glowna; przy
 * udziale - "ok. N%". Przy nadmiarze wody bez przyczyn sekcja znika (fakty sa w szczegolach).
 */
/** Bez niedoboru (w normie, poza sezonem) przyczyny to czynniki ryzyka pola, a nie "dlaczego brakuje wody". */
function causesTitleKey(level: string): 'title' | 'titleExcess' | 'titleRisk' {
  if (level === 'excess') return 'titleExcess';

  return level === 'drought' || level === 'risk' ? 'title' : 'titleRisk';
}

export function SimpleCauses({ report }: { report: WaterReport }) {
  const t = useTranslations('report.simple.causes');
  const tItems = useTranslations('report.causes.items');
  const causes = byWeight(report.causes).slice(0, MAX_CAUSES);

  if (causes.length === 0) return null;

  return (
    <section
      aria-labelledby="dlaczego-title"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card sm:p-6 print:break-inside-avoid print:p-4 print:shadow-none"
      data-testid="simple-causes"
    >
      <h3 id="dlaczego-title" className="text-xl font-semibold">
        {t(causesTitleKey(report.assessment.level))}
      </h3>
      <ol className="flex flex-col gap-4">
        {causes.map((cause, index) => {
          const share = causeShare(cause, report.causes);

          return (
            <li key={cause.id} className="grid grid-cols-[1.25rem_1fr] gap-x-3" data-simple-cause={cause.id}>
              <span aria-hidden="true" className="flex h-7 items-center justify-center">
                <span className={cn('rounded-full', DOT[index] ?? DOT[3])} />
              </span>
              <p className="flex flex-wrap items-baseline gap-x-2 text-lg leading-snug font-semibold">
                {tItems(`${cause.id}.title`)}
                {index === 0 && (
                  <span className="rounded-full bg-data-orange-dark px-2 py-0.5 text-sm font-semibold text-data-sand">
                    {t('main')}
                  </span>
                )}
                {share !== null && (
                  <span className="text-base font-normal text-muted-foreground">
                    {t('share', { percent: percentOf(share) })}
                  </span>
                )}
              </p>
              <p className="col-start-2 text-base leading-snug text-muted-foreground">
                {tItems(`${cause.id}.description`)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
