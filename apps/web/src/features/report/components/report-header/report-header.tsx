import type { WaterReport } from '@app/contracts';
import { ArrowLeft, MapPinned } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

import { registryArea } from '../../utils/land-use';
import { isoDay } from '../../utils/report-data';
import { CopyLinkButton } from '../copy-link-button';
import { useLandUseWords } from '../land-use-notice';
import { PrintButton } from '../print-button';

// na telefonie dwa przyciski obok siebie: tekst moze sie zawinac, cel dotykowy zostaje >= 48 px
const COMPACT = 'h-auto min-h-12 py-2 leading-tight whitespace-normal max-sm:px-3 max-sm:text-sm';

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
}

/**
 * Naglowek raportu (ekran i A4): pole, dzialki, uprawa, dzien analizy, powierzchnia (z obrysu i ewidencyjna) i uzytki
 * z ewidencji slowami, a na ekranie akcje - wydruk/PDF, zmiana uprawy lub daty, link do raportu, powrot do mapy
 * (na wydruku ukryte).
 */
export function ReportHeader({ report, changeHref, mapHref }: ReportHeaderProps) {
  const t = useTranslations('report');
  const tCrops = useTranslations('analysis.crops');
  const format = useFormatter();
  const landUseWords = useLandUseWords();
  const { field } = report;
  const area = (value: number) => format.number(value, { maximumFractionDigits: 2 });
  const registry = registryArea(report);
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
    <header className="flex flex-col gap-4" data-testid="report-header">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-tight font-bold text-primary print:text-2xl">{t('title')}</h1>
        {field.label && <p className="text-lg font-medium">{field.label}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 print:grid-cols-4">
        {items
          .filter((item) => item !== null)
          .map((item) => (
            <div
              key={item.label}
              className={cn('flex min-w-0 flex-col', item.wide && 'col-span-2 print:col-span-2')}
            >
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-base font-semibold wrap-anywhere">{item.value}</dd>
              {item.note && <dd className="text-sm text-muted-foreground">{item.note}</dd>}
            </div>
          ))}
      </dl>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap print:hidden">
        <PrintButton className={COMPACT} />
        <Button asChild size="xl" variant="outline" className={COMPACT}>
          <Link href={changeHref}>
            <ArrowLeft aria-hidden="true" />
            {t('actions.change')}
          </Link>
        </Button>
        <CopyLinkButton className="max-sm:col-span-2" />
        <Button asChild size="xl" variant="ghost" className="max-sm:hidden">
          <Link href={mapHref}>
            <MapPinned aria-hidden="true" />
            {t('actions.map')}
          </Link>
        </Button>
      </div>
    </header>
  );
}
