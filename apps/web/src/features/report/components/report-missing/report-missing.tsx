import { FileQuestion } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

export interface ReportMissingProps {
  /** formularz analizy; null = w adresie nie ma nawet dzialek (zostaje tylko mapa) */
  changeHref: AppHref | null;
  mapHref: AppHref;
}

/** Adres raportu bez dzialek, uprawy albo daty (urwany link): mowi, czego brakuje, i prowadzi do formularza. */
export function ReportMissing({ changeHref, mapHref }: ReportMissingProps) {
  const t = useTranslations('report.missing');

  return (
    <EmptyState titleAs="h1" icon={FileQuestion} title={t('title')} description={t('description')}>
      {changeHref ? (
        <Button asChild size="xl">
          <Link href={changeHref}>{t('back')}</Link>
        </Button>
      ) : (
        <Button asChild size="xl">
          <Link href={mapHref}>{t('map')}</Link>
        </Button>
      )}
    </EmptyState>
  );
}
