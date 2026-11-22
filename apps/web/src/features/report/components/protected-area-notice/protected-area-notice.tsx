import type { ProtectedArea } from '@app/contracts';
import { Leaf } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Slowo rodzaju w nazwie BDOT10k ("Biebrzanski Park Narodowy") - wtedy nie dopisujemy go drugi raz. */
const KIND_WORDS: Record<Exclude<ProtectedArea['kind'], 'natura2000'>, RegExp> = {
  national_park: /park narodowy/iu,
  nature_reserve: /rezerwat/iu,
  landscape_park: /park krajobrazowy/iu,
};

/** Nazwy obszarow do zdania: parki i rezerwaty po kolei, obszary Natura 2000 razem ("Natura 2000: A, B"). */
export function useProtectedAreaNames(): (areas: readonly ProtectedArea[]) => string {
  const t = useTranslations('report.surroundings');
  const format = useFormatter();

  return (areas) => {
    const natura = areas.filter((area) => area.kind === 'natura2000').map((area) => area.name);
    const others = areas.flatMap((area) =>
      area.kind === 'natura2000'
        ? []
        : [
            KIND_WORDS[area.kind].test(area.name)
              ? area.name
              : t('areaNamed', { kind: t(`areaKinds.${area.kind}`), name: area.name }),
          ],
    );
    const parts = [
      ...new Set(others),
      ...(natura.length > 0 ? [t('natura2000', { names: format.list([...new Set(natura)]) })] : []),
    ];

    return parts.join('; ');
  };
}

/**
 * Spokojna ramka u gory raportu (takze na wydruku), gdy pole lezy w obszarze chronionym: nazwy obszarow i zdanie, ze
 * oczko, zastawka i zmiana stosunkow wodnych wymagaja tu uzgodnien. Przepisy cytuja dopiski serwera przy zaleceniach.
 */
export function ProtectedAreaNotice({ areas }: { areas: readonly ProtectedArea[] | undefined }) {
  const t = useTranslations('report.surroundings');
  const names = useProtectedAreaNames();

  if (!areas || areas.length === 0) return null;

  return (
    <Alert className="text-base print:break-inside-avoid" data-testid="protected-area-notice">
      <Leaf aria-hidden="true" />
      <AlertTitle className="line-clamp-none text-base leading-snug font-semibold">
        {t('protectedTitle', { areas: names(areas) })}
      </AlertTitle>
      <AlertDescription className="text-sm text-foreground">{t('protectedText')}</AlertDescription>
    </Alert>
  );
}
