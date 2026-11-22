import { Check, MapPinned } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';

import { ExampleReports } from '../example-reports';
import { HomeSearch } from './home-search';

const PROMISES = ['free', 'noAccount', 'fast'] as const;
const STEPS = ['find', 'check', 'analyze'] as const;
const SOURCES = ['weather', 'satellite', 'soil', 'water', 'parcel'] as const;
const QUESTIONS = ['cost', 'account', 'number', 'accuracy', 'phone', 'aid'] as const;

/** Naglowek sekcji strony glownej (ta sama skala wszedzie). */
function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-3xl font-medium tracking-tight md:text-4xl">
      {children}
    </h2>
  );
}

/**
 * Strona glowna wg makiety "Propozycja A": na pierwszym ekranie pole na numer dzialki, "Nie znam numeru - wskaze na
 * mapie" i trzy obietnice (bezplatnie, bez konta, wynik w kilkanascie sekund); nizej przyklady wyniku, trzy kroki,
 * zrodla danych, pytania rolnikow. Jedno glowne dzialanie: sprawdzic dzialke.
 */
export function HomeScreen() {
  const t = useTranslations('parcels.home');

  return (
    <div className="flex flex-col">
      <section
        aria-labelledby="home-title"
        className="flex flex-col items-center px-gutter pt-8 pb-12 text-center md:pt-16"
      >
        <h1
          id="home-title"
          className="max-w-4xl text-4xl font-medium tracking-tighter text-balance md:text-6xl"
        >
          {t('title')}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl md:leading-normal">
          {t('lead')}
        </p>
        <div className="mt-8 flex w-full max-w-3xl flex-col items-center gap-4">
          <HomeSearch />
          <div className="flex w-full flex-col items-center gap-3">
            <Button asChild variant="secondary" size="lg" className="max-md:w-full">
              <Link href={routes.map()}>
                <MapPinned aria-hidden="true" />
                <span className="md:hidden">{t('noNumberShort')}</span>
                <span className="max-md:hidden">{t('noNumber')}</span>
              </Link>
            </Button>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1">
              {PROMISES.map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <Check aria-hidden="true" className="size-5 text-success" strokeWidth={2.6} />
                  {t(`promises.${key}`)}
                </li>
              ))}
            </ul>
          </div>
          <details className="group w-full max-w-2xl text-left">
            <summary className="mx-auto flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full px-4 font-medium underline underline-offset-4 marker:content-none">
              {t('search.whereNumber')}
            </summary>
            <p className="mt-2 rounded-2xl bg-muted px-5 py-4">{t('search.whereNumberText')}</p>
          </details>
        </div>
      </section>

      <section
        aria-labelledby="examples-title"
        className="border-y border-secondary-border bg-secondary px-gutter py-12"
      >
        <div className="mx-auto flex max-w-page flex-col gap-6">
          <div className="flex flex-col gap-2">
            <SectionTitle id="examples-title">{t('examples.title')}</SectionTitle>
            <p className="max-w-2xl text-lg">{t('examples.text')}</p>
          </div>
          <ExampleReports />
        </div>
      </section>

      <section aria-labelledby="steps-title" className="mx-auto w-full max-w-page px-gutter pt-16">
        <div className="flex flex-col gap-6">
          <SectionTitle id="steps-title">{t('steps.title')}</SectionTitle>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((key, index) => (
              <li key={key} className="flex flex-col gap-2.5 rounded-3xl bg-muted p-6">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground"
                >
                  {index + 1}
                </span>
                <span className="text-xl font-medium">{t(`steps.${key}.title`)}</span>
                <span className="text-lg text-muted-foreground">{t(`steps.${key}.text`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="data-title"
        className="mx-auto grid w-full max-w-page gap-8 px-gutter pt-16 lg:grid-cols-[3fr_2fr]"
      >
        <div className="flex flex-col gap-4">
          <SectionTitle id="data-title">{t('data.title')}</SectionTitle>
          <p className="text-lg text-muted-foreground">{t('data.text')}</p>
          <ul className="flex flex-col border-t">
            {SOURCES.map((key) => (
              <li key={key} className="border-b py-3 text-lg">
                <strong className="font-semibold">{t(`data.${key}.label`)}</strong> {t(`data.${key}.text`)}{' '}
                <span className="text-sm text-muted-foreground">{t(`data.${key}.source`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="flex flex-col gap-2 self-start rounded-3xl bg-muted p-6">
          <h3 className="text-xl font-medium">{t('data.honestTitle')}</h3>
          <p className="text-lg">{t('data.honestText')}</p>
          <Link
            href={routes.method()}
            className="mt-1 inline-flex min-h-11 w-fit items-center font-medium underline underline-offset-4"
          >
            {t('data.methodLink')}
          </Link>
        </aside>
      </section>

      <section aria-labelledby="faq-title" className="mx-auto w-full max-w-page px-gutter pt-16">
        <div className="flex flex-col gap-4">
          <SectionTitle id="faq-title">{t('faq.title')}</SectionTitle>
          <dl className="grid gap-x-8 md:grid-cols-2">
            {QUESTIONS.map((key) => (
              <div key={key} className="flex flex-col gap-1.5 border-b py-4">
                <dt className="text-xl font-medium">{t(`faq.${key}.q`)}</dt>
                <dd className="text-lg text-muted-foreground">{t(`faq.${key}.a`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="mt-16 surface-panel px-gutter py-12">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h2 id="cta-title" className="text-3xl font-medium tracking-tight md:text-4xl">
              {t('cta.title')}
            </h2>
            <p className="text-lg text-muted-foreground">{t('cta.text')}</p>
          </div>
          <Button asChild variant="accent" size="xl" className="max-sm:w-full">
            <Link href="#szukaj">{t('cta.action')}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
