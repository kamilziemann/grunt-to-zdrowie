import { useTranslations } from 'use-intl';

import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';

/**
 * Stopka stron z trescia: skad sa dane (te same zrodla, z ktorych liczy silnik) i zastrzezenie, ze wynik to porada,
 * a nie ekspertyza. Strony z mapa na caly ekran stopki nie maja (atrybucje sa na mapie).
 */
export function AppFooter({ appName }: { appName: string }) {
  const t = useTranslations('common.footer');

  return (
    // telefon: na stronie raportu u dolu stoi przyklejony pasek akcji - stopka dostaje pod soba miejsce na niego
    <footer className="border-t print:hidden max-sm:[body:has([data-testid=share-bar])_&]:pb-20">
      <div className="mx-auto flex max-w-page flex-col gap-3 px-gutter py-6 text-sm text-muted-foreground">
        <p className="max-w-3xl text-base text-foreground">{t('advice')}</p>
        <p className="max-w-4xl">{t('sources')}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>{t('project', { name: appName })}</span>
          <Link
            href={routes.method()}
            className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:decoration-2"
          >
            {t('method')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
