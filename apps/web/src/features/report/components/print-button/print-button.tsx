import { Printer } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

/** "Drukuj / zapisz PDF": okno wydruku przegladarki (A4 z `@media print`); zapis do PDF to opcja tego okna. */
export function PrintButton({ className, short = false }: { className?: string; short?: boolean }) {
  const t = useTranslations('report.actions');
  const print = useCallback(() => {
    window.print();
  }, []);

  return (
    <Button size="xl" onClick={print} className={className}>
      <Printer aria-hidden="true" />
      {short ? t('savePdf') : t('print')}
    </Button>
  );
}
