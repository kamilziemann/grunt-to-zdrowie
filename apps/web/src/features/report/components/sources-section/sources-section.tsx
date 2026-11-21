import type { SourceRef, WaterReport } from '@app/contracts';
import { BookOpen, CircleAlert, CircleCheck, CircleX, ExternalLink, type LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { APP_TIME_ZONE } from '@/lib/locale';
import { Link } from '@/lib/navigation';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils/cn';

import { isoDay, sampleScope } from '../../utils/report-data';
import { ExportButtons } from '../export-buttons';

const STATUS_STYLES: Record<SourceRef['status'], { icon: LucideIcon; badge: string }> = {
  ok: { icon: CircleCheck, badge: 'border-success/50 bg-success/10 text-foreground [&>svg]:text-success' },
  partial: {
    icon: CircleAlert,
    badge: 'border-warning/60 bg-warning/10 text-foreground [&>svg]:text-warning',
  },
  missing: {
    icon: CircleX,
    badge: 'border-destructive/50 bg-destructive/10 text-foreground [&>svg]:text-destructive',
  },
};

function isWebUrl(url: string | undefined): url is `https://${string}` | `http://${string}` {
  return url !== undefined && /^https?:\/\//.test(url);
}

/**
 * Sekcja 7 - wiarygodnosc: pewnosc oceny, kazde zrodlo z dostawca, stanem (brak i dane niepelne nazwane wprost
 * zdaniem z tlumaczen), znacznikiem atrapy, zakresem dat, dokladnoscia i licencja, lista ograniczen i metryczka
 * raportu. Techniczna nota silnika (bywa po angielsku) jest tylko w szczegolach dla doradcy.
 */
export function SourcesSection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.sources');
  const tVerdict = useTranslations('report.verdict');
  const format = useFormatter();
  const day = (date: string) => format.dateTime(isoDay(date), { dateStyle: 'medium', timeZone: 'UTC' });
  const moment = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short', timeZone: APP_TIME_ZONE });
  const { confidence } = report.assessment;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 rounded-lg border bg-card p-4 print:break-inside-avoid">
        <p className="text-lg font-semibold">
          {t('confidence', { level: tVerdict(`confidenceLevels.${confidence}`) })}
        </p>
        <p className="text-base text-muted-foreground">{t(`confidenceExplain.${confidence}`)}</p>
      </div>

      <ul aria-label={t('listLabel')} className="grid gap-3 sm:grid-cols-2">
        {report.sources.map((source) => {
          const status = STATUS_STYLES[source.status];
          const StatusIcon = status.icon;
          const facts = [
            source.dataFrom && source.dataTo
              ? t('range', { from: day(source.dataFrom), to: day(source.dataTo) })
              : source.dataTo
                ? t('rangeTo', { to: day(source.dataTo) })
                : null,
            source.resolution ? t('resolution', { value: source.resolution }) : null,
            source.licence ? t('licence', { value: source.licence }) : null,
            source.fetchedAt ? t('fetched', { date: moment(source.fetchedAt) }) : null,
          ].filter((fact): fact is string => fact !== null);

          return (
            <li
              key={`${source.id}:${source.provider}`}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm print:break-inside-avoid"
              data-source={source.id}
              data-status={source.status}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{t(`categories.${source.id}`)}</h3>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium [&>svg]:size-3.5',
                      status.badge,
                    )}
                  >
                    <StatusIcon aria-hidden="true" />
                    {t(`status.${source.status}`)}
                  </span>
                  {source.sample && (
                    <span className="inline-flex items-center rounded-full border border-warning/60 bg-warning/10 px-2 py-0.5 text-xs font-semibold">
                      {t('sampleBadge')}
                    </span>
                  )}
                </div>
              </div>
              <p className="font-medium">{source.provider}</p>
              {facts.length > 0 && <p className="text-muted-foreground">{facts.join(' · ')}</p>}
              {source.status !== 'ok' && <p>{t(`statusNote.${source.status}`)}</p>}
              {source.note && (
                <details className="group text-muted-foreground" data-testid="source-note">
                  <summary className="flex min-h-11 w-fit cursor-pointer items-center font-medium text-foreground print:min-h-0">
                    {t('advisorDetails')}
                  </summary>
                  <p className="break-words">{source.note}</p>
                </details>
              )}
              {isWebUrl(source.url) && (
                <Link
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline print:min-h-0"
                >
                  <ExternalLink aria-hidden="true" className="size-4 print:hidden" />
                  {t('link', { provider: source.provider })}
                  <span className="hidden break-all print:inline">: {source.url}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 print:break-inside-avoid">
        <h3 className="text-lg font-semibold">{t('limitations')}</h3>
        {report.limitations.length === 0 ? (
          <p className="text-base text-muted-foreground">{t('limitationsNone')}</p>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base">
            {report.limitations.map((limitation) => (
              <li key={limitation} data-limitation={limitation}>
                {/* atrapa tylko czesci zrodel: o tym, ktorych, mowi baner na gorze - tu bez "wyniki nie opisuja pola" */}
                {limitation === 'sample_data' && sampleScope(report) === 'some'
                  ? t('limitationItems.sample_data_partial')
                  : t(`limitationItems.${limitation}`)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={routes.method()}
        className="inline-flex min-h-11 w-fit items-center gap-2 font-medium text-primary underline-offset-4 hover:underline print:hidden"
        data-testid="method-link"
      >
        <BookOpen aria-hidden="true" className="size-4" />
        {t('methodLink')}
      </Link>

      <ExportButtons report={report} />

      <p className="text-xs text-muted-foreground">
        {t('meta', {
          id: report.meta.reportId,
          version: report.meta.engineVersion,
          date: moment(report.meta.generatedAt),
          seconds: format.number(report.meta.durationMs / 1000, { maximumFractionDigits: 1 }),
        })}
      </p>
    </div>
  );
}
