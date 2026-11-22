import type { WaterReport } from '@app/contracts';
import { useSyncExternalStore } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { APP_TIME_ZONE, localizePath, useAppLocale } from '@/lib/locale';
import { routes } from '@/lib/routes';
import { BRAND } from '@/lib/seo';

const noop = () => () => undefined;
const currentOrigin = () => window.location.origin;
const noOrigin = () => '';

/** Krotki adres zapisanego raportu (`/raport?raport=r-…`) - tylko w przegladarce; na serwerze pusty. */
function useReportUrl(reportId: string): string {
  const origin = useSyncExternalStore(noop, currentOrigin, noOrigin);
  const locale = useAppLocale();

  return origin ? `${origin}${localizePath(routes.report({ raport: reportId }), locale)}` : '';
}

/**
 * Naglowek wydruku: nazwa aplikacji, kiedy raport wygenerowano i adres, pod ktorym da sie go otworzyc ponownie.
 * Na ekranie ukryty (te informacje sa w naglowku raportu i w metryczce).
 */
export function PrintHeader({ report }: { report: WaterReport }) {
  const t = useTranslations('report.print');
  const format = useFormatter();
  const url = useReportUrl(report.meta.reportId);

  return (
    <div
      className="hidden items-start justify-between gap-6 border-b pb-2 text-xs print:flex"
      data-testid="print-header"
    >
      <p className="text-sm font-semibold">{t('header', { app: BRAND })}</p>
      <div className="flex flex-col items-end text-right">
        <span>
          {t('generated', {
            date: format.dateTime(new Date(report.meta.generatedAt), {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: APP_TIME_ZONE,
            }),
          })}
        </span>
        {url && <span className="break-all">{t('address', { url })}</span>}
      </div>
    </div>
  );
}

/** Stopka wydruku: dostawcy danych (bez powtorzen), licencje w sekcji 7 i metryczka raportu. */
export function PrintFooter({ report }: { report: WaterReport }) {
  const t = useTranslations('report.print');
  const tSources = useTranslations('report.sources.categories');
  const format = useFormatter();
  const providers = report.sources.map(
    (source) => `${tSources(source.id)}: ${source.provider}${source.sample ? ` (${t('sample')})` : ''}`,
  );

  return (
    <footer className="hidden flex-col gap-1 border-t pt-2 text-xs print:flex" data-testid="print-footer">
      <p>{t('sources', { sources: format.list(providers, { type: 'conjunction' }) })}</p>
      <p>{t('footerMeta', { app: BRAND, id: report.meta.reportId, version: report.meta.engineVersion })}</p>
    </footer>
  );
}
