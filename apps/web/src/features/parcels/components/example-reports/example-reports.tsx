import { ArrowRight } from 'lucide-react';
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
/** Parametry przykladu `ditch` - z niego sa tez liczby w karcie "Przyklad wyniku" na stronie glownej. */
export const DITCH_EXAMPLE = {
  dzialki: '080904_5.0001.349/1',
  uprawa: 'winter_wheat',
  data: '2018-06-15',
} as const;

export const EXAMPLE_REPORTS = {
  ditch: routes.report(DITCH_EXAMPLE),
  dry: routes.report({ dzialki: '141507_2.0019.254', uprawa: 'spring_barley', data: '2023-06-20' }),
  wet: routes.report({ dzialki: '141507_2.0010.39/2', uprawa: 'grassland', data: '2017-09-20' }),
} as const;

const TODAY_EXAMPLE = { dzialki: '142909_2.0013.178', uprawa: 'winter_wheat' } as const;

/**
 * "Zobacz inne przyklady" na stronie glownej: cztery jasne karty "Przyklad", kazda jednym kliknieciem otwiera gotowy
 * raport z jednym zdaniem "co tu zobaczysz". Teksty z `parcels.firstSteps.examples`.
 */
export function ExampleReports({ className }: { className?: string }) {
  const t = useTranslations('parcels');
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
    <ul className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)} data-testid="examples">
      {examples.map(({ key, href }) => (
        <li key={key} className="flex">
          <Link
            href={href}
            className="group flex flex-1 flex-col gap-3 rounded-2xl border bg-card p-5 transition-[border-color,transform] hover:border-foreground/40 motion-safe:hover:-translate-y-0.5"
            data-example={key}
          >
            <span className="w-fit rounded-full bg-accent px-3 py-0.5 text-sm font-semibold text-accent-foreground">
              {t('home.examples.badge')}
            </span>
            <span className="text-xl leading-snug font-medium">{t(`firstSteps.examples.${key}.title`)}</span>
            <span className="text-sm text-muted-foreground">{t(`firstSteps.examples.${key}.place`)}</span>
            <span className="text-base leading-snug">{t(`firstSteps.examples.${key}.note`)}</span>
            <ArrowRight
              aria-hidden="true"
              className="mt-auto size-6 self-end transition-transform group-hover:translate-x-1"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
