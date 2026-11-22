import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';
import { routes, type AppHref } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { DITCH_EXAMPLE } from '../example-reports';
import { SectionTitle } from './section-title';

/** Czesci wyniku, ktore naprawde sa w raporcie: gora strony, rozwijane szczegoly i wydruk A4. */
const VIEWS: readonly { key: 'simple' | 'detailed' | 'print'; href?: AppHref }[] = [
  { key: 'simple', href: routes.report(DITCH_EXAMPLE) },
  { key: 'detailed', href: routes.report({ ...DITCH_EXAMPLE, widok: 'szczegoly' }) },
  { key: 'print' },
];

/**
 * "Co dostaniesz" (`#wynik`): makieta ma piec zakladek, nasz raport to jedna strona z rozwijanymi szczegolami i wydruk - opisujemy to, co jest.
 * Pierwsza karta na ciemnym panelu (najwazniejszy widok; fokus w panelu jest mietowy), dwie pierwsze prowadza
 * do przykladu w danym widoku.
 */
export function HomeResults() {
  const t = useTranslations('parcels.home.results');

  return (
    <section
      id="wynik"
      aria-labelledby="results-title"
      className="mx-auto w-full max-w-page scroll-mt-20 px-gutter pt-16 md:pt-20"
    >
      <div className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-2.5">
          <SectionTitle id="results-title">{t('title')}</SectionTitle>
          <p className="text-lg text-muted-foreground">{t('text')}</p>
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          {VIEWS.map(({ key, href }, index) => {
            const first = index === 0;

            return (
              <li
                key={key}
                className={cn('flex flex-col gap-2 rounded-2xl p-6', first ? 'surface-panel' : 'border')}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 place-items-center rounded-full font-semibold',
                    first
                      ? 'bg-accent text-accent-foreground'
                      : 'border border-secondary-border bg-secondary text-secondary-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <h3 className="text-xl font-medium">{t(`${key}.title`)}</h3>
                <p className={cn('text-base', !first && 'text-muted-foreground')}>{t(`${key}.text`)}</p>
                {href && (
                  <Link
                    href={href}
                    className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 pt-1 font-medium underline underline-offset-4 hover:decoration-2"
                  >
                    {t('open')}
                    <ArrowRight aria-hidden="true" className="size-5" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
