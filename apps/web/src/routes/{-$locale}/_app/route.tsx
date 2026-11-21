// Powloka aplikacji (naglowek z nawigacja i menu konta, tresc, stopka) dla wszystkich stron. Trasa bez segmentu
// w adresie (`_app`). 404 (`notFound()` z loadera albo nieznany adres) obsluguje ta trasa: SSR szuka granicy tylko
// w `notFoundComponent` tras, a granica zastepuje komponent trasy - stad powloka tez tu.
import { createFileRoute, notFound, Outlet, useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { AppNav } from '@/components/shared/app-nav';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/features/auth';
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
      <EmptyState titleAs="h1" title={t('notFoundTitle')} description={t('notFoundDescription')}>
        <Button asChild variant="outline">
          <Link href={routes.home()}>{t('backHome')}</Link>
        </Button>
      </EmptyState>
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

  return (
    <div className={cn('flex flex-col', fullBleed ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-1.5 focus:text-sm"
      >
        {t('skipToContent')}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur print:hidden">
        <div
          className={cn(
            'flex w-full items-center gap-4 px-gutter',
            fullBleed ? 'py-2' : 'mx-auto max-w-page py-3',
          )}
        >
          <AppNav appName={BRAND}>
            <UserMenu />
          </AppNav>
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
            className="mx-auto w-full max-w-page flex-1 px-gutter py-8 print:max-w-none print:p-0"
          >
            {children}
          </main>
          <footer className="flex flex-wrap items-center justify-center gap-x-4 border-t py-2 text-xs text-muted-foreground print:hidden">
            <span>{BRAND}</span>
            <Link
              href={routes.method()}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('methodLink')}
            </Link>
          </footer>
        </>
      )}
    </div>
  );
}
