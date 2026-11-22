import type { WaterReport } from '@app/contracts';
import { ArrowLeft, MapPinned, RefreshCw } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';
import { Link } from '@/lib/navigation';
import { routes, type AppHref } from '@/lib/routes';

import { registryArea } from '../../utils/land-use';
import { isoDay } from '../../utils/report-data';
import { CopyLinkButton } from '../copy-link-button';
import { useLandUseWords } from '../land-use-notice';
import { PrintButton } from '../print-button';

// na telefonie dwa przyciski obok siebie: tekst moze sie zawinac, cel dotykowy zostaje >= 48 px
// przyciski naglowka w jednym rzedzie (48 px, tekst 16 px); na telefonie zawijaja sie w dwie linie, nie wychodza poza ekran
const COMPACT = 'h-auto min-h-12 px-4 py-2 text-base leading-tight whitespace-normal';

interface HeaderItem {
  label: string;
  value: string;
  /** na dwie kolumny (dlugi tekst) */
  wide?: boolean;
  /** druga linia drobnym drukiem */
  note?: string;
}

export interface ReportHeaderProps {
  report: WaterReport;
  /** formularz analizy z tymi samymi dzialkami, uprawa i data */
  changeHref: AppHref;
  /** mapa z tymi samymi dzialkami */
  mapHref: AppHref;
  /** raport z zapisu (krotki link): adres z parametrami - przycisk "Policz ponownie" */
  recomputeHref?: AppHref;
}

/**
 * Naglowek raportu (ekran i A4): pole, dzialki, uprawa, dzien analizy, powierzchnia (z obrysu i ewidencyjna) i uzytki
 * z ewidencji slowami, a na ekranie akcje - wydruk/PDF, zmiana uprawy lub daty, link do raportu, powrot do mapy
 * (na wydruku ukryte). Raport z zapisu mowi dyskretnie, kiedy go policzono; z krotkiego linku ma "Policz ponownie".
 */
export function ReportHeader({ report, changeHref, mapHref, recomputeHref }: ReportHeaderProps) {
  const t = useTranslations('report');
  const tCrops = useTranslations('analysis.crops');
  const format = useFormatter();
  const landUseWords = useLandUseWords();
  const { field } = report;
  const area = (value: number) => format.number(value, { maximumFractionDigits: 2 });
  const registry = registryArea(report);
  const computedAt = new Date(report.meta.generatedAt);
  // slowa z opisu uzytku w raporcie (pewniejszy), a gdy go nie ma - z klasouzytkow pola
  const landUseCodes = report.landUse?.codes ?? field.landUse ?? [];
  const items: (HeaderItem | null)[] = [
    field.parcelIds.length > 0
      ? {
          label: t('header.parcels', { count: field.parcelIds.length }),
          value: field.parcelIds.join(', '),
          // pelny identyfikator (080904_5.0001.349/1) nie miesci sie w pol szerokosci telefonu
          wide: true,
        }
      : null,
    { label: t('header.crop'), value: tCrops(`${report.crop.cropId}.name`) },
    {
      label: t('header.date'),
      value: format.dateTime(isoDay(report.meta.analysisDate), { dateStyle: 'long', timeZone: 'UTC' }),
    },
    {
      label: t('header.area'),
      value: t('header.areaValue', { area: area(field.areaHa) }),
      // powierzchnia z obrysu i ewidencyjna roznia sie zwykle o ulamki - pokazujemy obie, bez wyboru "prawdziwej"
      note:
        registry !== null && area(registry) !== area(field.areaHa)
          ? t('header.areaRegistry', { area: area(registry) })
          : undefined,
    },
    landUseCodes.length > 0
      ? { label: t('header.landUse'), value: landUseWords(landUseCodes), wide: true }
      : null,
  ];

  return (
    <header className="flex flex-col gap-5" data-testid="report-header">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-tight font-bold text-primary print:text-2xl">{t('title')}</h1>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {field.label && <span className="text-lg font-medium">{field.label}</span>}
          {/* powrot do mapy jako link przy nazwie pola - przyciski zostaja dla PDF, zmiany i linku */}
          <Link
            href={mapHref}
            className="inline-flex min-h-11 items-center gap-1.5 font-medium underline underline-offset-4 print:hidden"
          >
            <MapPinned aria-hidden="true" className="size-4" />
            {t('actions.map')}
          </Link>
        </p>
      </div>
      {/* telefon: dwie kolumny; od `sm` pozycje w rzedzie, kazda tak szeroka, jak jej tresc (bez dziur w siatce) */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10 print:flex print:flex-wrap print:gap-x-8">
        {items
          .filter((item) => item !== null)
          .map((item) => (
            <div key={item.label} className={cn('flex min-w-0 flex-col', item.wide && 'col-span-2')}>
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-base font-semibold wrap-anywhere">{item.value}</dd>
              {item.note && <dd className="text-sm text-muted-foreground">{item.note}</dd>}
            </div>
          ))}
      </dl>
      {(recomputeHref || report.meta.reused) && (
        <div
          className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground"
          data-testid="report-stored"
        >
          <p>
            {t('stored.computed', {
              date: format.dateTime(computedAt, { dateStyle: 'long', timeZone: APP_TIME_ZONE }),
              time: format.dateTime(computedAt, { timeStyle: 'short', timeZone: APP_TIME_ZONE }),
            })}
          </p>
          {recomputeHref && (
            <Button asChild variant="link" className="min-h-11 px-0 print:hidden">
              <Link href={recomputeHref}>
                <RefreshCw aria-hidden="true" />
                {t('stored.recompute')}
              </Link>
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        {/* na telefonie PDF i link sa w pasku na dole ekranu */}
        <PrintButton className={cn(COMPACT, 'max-sm:hidden')} />
        <Button asChild variant="outline" className={COMPACT}>
          <Link href={changeHref}>
            <ArrowLeft aria-hidden="true" />
            {t('actions.change')}
          </Link>
        </Button>
        <CopyLinkButton
          className="max-sm:hidden"
          buttonClassName="h-12 w-auto px-4 text-base"
          path={routes.report({ raport: report.meta.reportId })}
        />
      </div>
    </header>
  );
}
