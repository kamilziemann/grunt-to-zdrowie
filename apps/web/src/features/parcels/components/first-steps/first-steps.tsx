import { ChevronRight, FileText, MapPin, Sprout } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { useToday } from '@/features/analysis';
import { Link } from '@/lib/navigation';
import { routes, type AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

/**
 * Przyklady dla jury i ciekawych - prawdziwe dzialki rolne (grunty orne wg ewidencji), kazda pokazuje inna sytuacje
 * (sprawdzone na zywo w silniku 0.5.0, 2026-11-22):
 * - `ditch`: Chwalim 349/1, pszenica ozima, 15.06.2018 - susza, row przez pole (428 m), zastawka, plan dawek;
 * - `dry`: Lyse (Kurpie) 254, jeczmien jary, 20.06.2023 - grunty klasy V-VI, susza (30.06.2019 daje juz tylko
 *   "obserwuj" po zmianie progow w silniku 0.5.0);
 * - `wet`: Lyse 39/2 (laki i grunty orne), laka, 20.09.2017 - nadmiar wody (KBW ok. +97 mm);
 * - `today`: Sterdyn 178, pszenica ozima, dzisiejsza data - poza sezonem raport mowi to wprost.
 */
export const EXAMPLE_REPORTS = {
  ditch: routes.report({ dzialki: '080904_5.0001.349/1', uprawa: 'winter_wheat', data: '2018-06-15' }),
  dry: routes.report({ dzialki: '141507_2.0019.254', uprawa: 'spring_barley', data: '2023-06-20' }),
  wet: routes.report({ dzialki: '141507_2.0010.39/2', uprawa: 'grassland', data: '2017-09-20' }),
} as const;

const TODAY_EXAMPLE = { dzialki: '142909_2.0013.178', uprawa: 'winter_wheat' } as const;

const STEPS = [
  { key: 'find', icon: MapPin },
  { key: 'crop', icon: Sprout },
  { key: 'report', icon: FileText },
] as const;

/**
 * Pierwsze wejscie: przyklady (kazdy jednym kliknieciem otwiera gotowy raport, z jednym zdaniem "co tu zobaczysz")
 * i co robi aplikacja w trzech krokach. Pokazywane, dopoki lista dzialek jest pusta i nic nie wyszukano - potem
 * ustepuje miejsca liscie. Przyklady stoja zaraz pod tytulem (pole wyszukiwania jest nad calym blokiem).
 */
export function FirstSteps({ className }: { className?: string }) {
  const t = useTranslations('parcels.firstSteps');
  const today = useToday();
  // "dzis" znamy dopiero w przegladarce (HTML z cache brzegowego); do tego czasu formularz z dzisiejsza data
  const todayHref: AppHref = today
    ? routes.report({ ...TODAY_EXAMPLE, data: today })
    : routes.analysis(TODAY_EXAMPLE.dzialki, { uprawa: TODAY_EXAMPLE.uprawa });
  const examples = [
    { key: 'ditch', href: EXAMPLE_REPORTS.ditch },
    { key: 'dry', href: EXAMPLE_REPORTS.dry },
    { key: 'wet', href: EXAMPLE_REPORTS.wet },
    { key: 'today', href: todayHref },
  ] as const;

  return (
    <section
      aria-labelledby="first-steps-title"
      className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4', className)}
      data-testid="first-steps"
    >
      <h2 id="first-steps-title" className="text-lg font-semibold text-balance max-md:text-base">
        {t('title')}
      </h2>
      {/* przyklady przed krokami: na telefonie pierwszy widac w arkuszu otwartym do polowy */}
      <div className="flex flex-col gap-2" data-testid="examples">
        <h3 id="examples-title" className="text-sm font-semibold text-muted-foreground">
          {t('examplesTitle')}
        </h3>
        <ul aria-labelledby="examples-title" className="flex flex-col gap-1.5">
          {examples.map(({ key, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="group flex min-h-12 items-center gap-3 rounded-lg border bg-background px-3 py-1.5 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
                data-example={key}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-primary">{t(`examples.${key}.title`)}</span>
                    <span className="text-xs text-muted-foreground">{t(`examples.${key}.place`)}</span>
                  </span>
                  <span className="text-sm leading-snug">{t(`examples.${key}.note`)}</span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <ol className="flex flex-col gap-2.5 max-md:gap-1.5">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"
            >
              <Icon className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">
                {index + 1}. {t(`steps.${key}.title`)}
              </span>
              <span className="text-sm text-muted-foreground max-md:hidden">{t(`steps.${key}.text`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
