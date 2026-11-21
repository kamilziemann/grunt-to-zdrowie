import type { WaterReport } from '@app/contracts';
import { Download } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

import { exportFileName, reportCsv, reportJson } from '../../utils/report-export';

function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();
  // przegladarka zaczyna pobieranie synchronicznie po kliknieciu - adres mozna zwolnic w nastepnym zadaniu
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * "Dla doradcy" (D7): pobranie danych raportu jako JSON (pelny raport z kontraktu) i CSV (plaska tabela do arkusza).
 * Plik powstaje w przegladarce z raportu, ktory juz jest na ekranie - bez kolejnego zapytania. Na wydruku ukryte.
 */
export function ExportButtons({ report }: { report: WaterReport }) {
  const t = useTranslations('report.export');
  const downloadJson = useCallback(
    () => download(reportJson(report), 'application/json', exportFileName(report, 'json')),
    [report],
  );
  const downloadCsv = useCallback(
    () => download(reportCsv(report), 'text/csv;charset=utf-8', exportFileName(report, 'csv')),
    [report],
  );

  return (
    <section className="flex flex-col gap-2 print:hidden" aria-labelledby="report-export-title">
      <h3 id="report-export-title" className="text-lg font-semibold">
        {t('title')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xl" onClick={downloadCsv}>
          <Download aria-hidden="true" />
          {t('csv')}
        </Button>
        <Button variant="outline" size="xl" onClick={downloadJson}>
          <Download aria-hidden="true" />
          {t('json')}
        </Button>
      </div>
    </section>
  );
}
