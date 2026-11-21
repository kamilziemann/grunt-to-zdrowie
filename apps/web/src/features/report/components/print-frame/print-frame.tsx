import type { WaterReport } from '@app/contracts';
import { useSyncExternalStore } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { APP_TIME_ZONE } from '@/lib/locale';
import { BRAND } from '@/lib/seo';

const noop = () => () => undefined;
const currentUrl = () => window.location.href;
const noUrl = () => '';

/** Adres strony raportu (dzialki, uprawa, dzien) - tylko w przegladarce; na serwerze pusty. */
function useReportUrl(): string {
  return useSyncExternalStore(noop, currentUrl, noUrl);
}

/**
 * Naglowek wydruku: nazwa aplikacji, kiedy raport wygenerowano i adres, pod ktorym da sie go otworzyc ponownie.
 * Na ekranie ukryty (te informacje sa w naglowku raportu i w metryczce).
 */
export function PrintHeader({ report }: { report: WaterReport }) {
  const t = useTranslations('report.print');
  const format = useFormatter();
  const url = useReportUrl();

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
