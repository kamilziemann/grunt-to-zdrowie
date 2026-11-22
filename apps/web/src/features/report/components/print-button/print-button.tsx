import { LoaderCircle, Printer } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

import { useSatellitePrint } from '../satellite-section';

/**
 * "Drukuj / zapisz PDF": okno wydruku przegladarki (A4 z `@media print`); zapis do PDF to opcja tego okna. Najpierw
 * pobiera zdjecia z satelity do sekcji "Pole z satelity" - w tym czasie mowi, ze je laduje.
 */
export function PrintButton({ className, short = false }: { className?: string; short?: boolean }) {
  const t = useTranslations('report.actions');
  const { print, preparing } = useSatellitePrint();
  const { toast } = useToast();
  // okno wydruku otwiera sie dopiero po zdjeciach z satelity - powiadomienie mowi, ze cos sie dzieje i co dalej
  const start = useCallback(() => {
    toast({ title: t('pdfToast'), description: t('pdfToastNote') });
    print();
  }, [print, toast, t]);

  return (
    <Button size="xl" onClick={start} className={className} aria-busy={preparing} disabled={preparing}>
      {preparing ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <Printer aria-hidden="true" />
      )}
      <span aria-live="polite">{preparing ? t('preparingPdf') : short ? t('savePdf') : t('print')}</span>
    </Button>
  );
}
