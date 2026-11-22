// Powloka aplikacji (naglowek z nawigacja, tresc, stopka) dla wszystkich stron. Trasa bez segmentu
// w adresie (`_app`). 404 (`notFound()` z loadera albo nieznany adres) obsluguje ta trasa: SSR szuka granicy tylko
// w `notFoundComponent` tras, a granica zastepuje komponent trasy - stad powloka tez tu.
import { createFileRoute, notFound, Outlet, useMatches } from '@tanstack/react-router';
import { MapPinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { AppFooter } from '@/components/shared/app-footer';
import { AppNav } from '@/components/shared/app-nav';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { BRAND, headTranslator, pageHead } from '@/lib/seo';
import { cn } from '@/lib/utils/cn';

export const Route = createFileRoute('/{-$locale}/_app')({
  beforeLoad: ({ context }) => {
    if (context.unknownPage) throw notFound();
  },
  // Tytul 404 (WCAG 2.4.2): trasa, ktora rzucila notFound, nie ma danych do wlasnego tytulu.
  head: ({ matches }) =>
    matches.some((match) => match.status === 'notFound')
      ? pageHead({ title: headTranslator(matches, 'errors')('notFoundTitle'), noindex: true })
      : {},
  component: AppLayout,
  notFoundComponent: AppNotFound,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AppNotFound() {
  const t = useTranslations('errors');

  return (
    <AppShell>
      {/* zwykla strona w siatce, nie ramka: popsuty link do raportu = od razu droga do sprawdzenia dzialki jeszcze raz */}
      <div className="mx-auto flex w-full max-w-page flex-col items-start gap-4 px-gutter py-16 md:py-24">
        <MapPinOff aria-hidden="true" className="size-10 text-muted-foreground" />
        <h1 className="text-4xl font-medium tracking-tight md:text-5xl">{t('notFoundTitle')}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t('notFoundDescription')}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="xl">
            <Link href={routes.home()}>{t('backHome')}</Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href={routes.map()}>{t('openMap')}</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  // Strona z mapa (`staticData.fullBleed`) dostaje cala wysokosc okna pod naglowkiem; okno sie nie przewija.
  const fullBleed = useMatches({
    select: (matches) =>
      matches.some((match) => match.staticData.fullBleed === true && match.status !== 'notFound'),
  });
  const wide = useMatches({
    select: (matches) =>
      matches.some((match) => match.staticData.wide === true && match.status !== 'notFound'),
  });

  return (
    <div className={cn('flex flex-col', fullBleed ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-base"
      >
        {t('skipToContent')}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur print:hidden">
        <div
          className={cn(
            'flex min-h-15 w-full items-center gap-4 px-gutter',
            fullBleed ? 'py-1.5' : 'mx-auto max-w-page py-2.5',
          )}
        >
          <AppNav appName={BRAND} />
        </div>
      </header>
      {fullBleed ? (
        <main id="main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      ) : (
        <>
          <main
            id="main"
            className={cn(
              'w-full flex-1',
              !wide && 'mx-auto max-w-page px-gutter py-8 print:max-w-none print:p-0',
            )}
          >
            {children}
          </main>
          <AppFooter appName={BRAND} />
        </>
      )}
    </div>
  );
}
