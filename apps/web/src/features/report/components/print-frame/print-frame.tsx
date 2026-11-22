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

/** Napis CSS w cudzyslowach (tresc pola marginesu strony); bez `<`, zeby opis pola nie zamknal elementu `style`. */
function cssString(text: string): string {
  return `"${text
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll(/[\n\r<]+/g, ' ')}"`;
}

/** Krotka nazwa dostawcy do stopki strony: "NASA POWER (MERRA-2, ...)" -> "NASA POWER". */
function shortProvider(provider: string): string {
  return provider.split(/ \(| - /)[0]?.trim() ?? provider;
}

/**
 * Naglowek i stopka na KAZDEJ stronie wydruku: pola marginesu `@page` (Chrome 131+) z nazwa aplikacji, pelnym
 * numerem dzialki, dniem analizy, identyfikatorem raportu, krotkim linkiem, zrodlami i numerem strony. Przegladarki bez pol marginesu drukuja jak dotad -
 * pelny naglowek na pierwszej stronie i stopke na ostatniej (`PrintHeader`, `PrintFooter`).
 */
export function PrintPageMargins({ report }: { report: WaterReport }) {
  const t = useTranslations('report.print');
  const format = useFormatter();
  const url = useReportUrl(report.meta.reportId);
  const date = format.dateTime(new Date(`${report.meta.analysisDate}T12:00:00Z`), {
    dateStyle: 'long',
    timeZone: 'UTC',
  });
  const providers = [...new Set(report.sources.map((source) => shortProvider(source.provider)))];
  const top = t('pageHeader', {
    app: BRAND,
    // pelny numer dzialki (doradca szuka go w ewidencji); wlasny obszar - jego nazwa
    field: report.field.parcelIds.length > 0 ? report.field.parcelIds.join(', ') : (report.field.label ?? ''),
    date,
  });
  const bottom = url
    ? t('pageFooterLink', { url, sources: providers.join(', ') })
    : t('pageFooter', { sources: providers.join(', ') });
  const css = `@media print { @page {
    margin: 18mm 12mm 18mm;
    @top-left { content: ${cssString(top)}; font: 8pt system-ui, sans-serif; color: var(--muted-foreground); vertical-align: bottom; padding-bottom: 3mm; }
    @top-right { content: ${cssString(t('pageId', { id: report.meta.reportId }))}; font: 8pt system-ui, sans-serif; color: var(--muted-foreground); vertical-align: bottom; padding-bottom: 3mm; }
    @bottom-left { content: ${cssString(bottom)}; font: 7.5pt system-ui, sans-serif; color: var(--muted-foreground); vertical-align: top; padding-top: 3mm; }
    @bottom-right { content: ${cssString(t('pageNumber'))} counter(page) " / " counter(pages); width: 24mm; white-space: nowrap; text-align: right; font: 8pt system-ui, sans-serif; color: var(--muted-foreground); vertical-align: top; padding-top: 3mm; }
  } }`;

  return <style data-testid="print-page-margins">{css}</style>;
}
