import type { LandUse } from '@app/contracts';
import { Info, MapPinned, Sprout, TreePine } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from '@/lib/navigation';
import type { AppHref } from '@/lib/routes';

import { classRange, landUseGroups } from '../../utils/land-use';

/** Uzytki slowami: "grunty orne klasy IVb-VI, laka klasy V i row" (kody zostaja w szczegolach dla doradcy). */
export function useLandUseWords(): (codes: readonly string[]) => string {
  const t = useTranslations('report.landUse');
  const format = useFormatter();

  return (codes) =>
    format.list(
      landUseGroups(codes).map((group) => {
        const kind = t(`kinds.${group.kind}`);
        const range = classRange(group.classes);

        if (!range) return kind;

        return range.from === range.to
          ? t('withClass', { kind, soilClass: range.from })
          : t('withClasses', { kind, from: range.from, to: range.to });
      }),
      { type: 'conjunction' },
    );
}

export interface LandUseNoticeProps {
  landUse: LandUse | undefined;
  /** ten sam raport z uprawa "laka lub pastwisko" */
  grasslandHref?: AppHref;
  /** mapa z wybranymi dzialkami */
  mapHref: AppHref;
}

/**
 * Ostrzezenie z ewidencji na samej gorze raportu (takze na wydruku). Grunt nierolny (las, droga, zabudowa): mocna
 * ramka, ze liczby opisuja pogode i glebe w tym miejscu, a nie uprawe. Same laki i pastwiska przy uprawie polowej:
 * spokojna podpowiedz z linkiem do raportu dla uzytkow zielonych. Brak opisu albo zwykle pole = nic.
 */
export function LandUseNotice({ landUse, grasslandHref, mapHref }: LandUseNoticeProps) {
  const t = useTranslations('report.landUse');
  const format = useFormatter();

  if (!landUse?.mismatch) return null;
  const kinds = format.list(
    landUse.kinds.map((kind) => t(`kinds.${kind}`)),
    { type: 'conjunction' },
  );

  if (landUse.mismatch === 'non_agricultural') {
    return (
      <Alert
        variant="warning"
        className="border-2 border-warning text-base print:break-inside-avoid"
        data-testid="land-use-notice"
        data-mismatch={landUse.mismatch}
      >
        <TreePine aria-hidden="true" />
        <AlertTitle className="line-clamp-none text-lg leading-snug font-semibold text-balance">
          {t('nonAgriculturalTitle', { kinds })}
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2 text-base text-foreground">
          <span>{t('nonAgriculturalText')}</span>
          <Link
            href={mapHref}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 font-medium text-primary underline underline-offset-4 print:hidden"
          >
            <MapPinned aria-hidden="true" className="size-4" />
            {t('nonAgriculturalMap')}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      className="text-base print:break-inside-avoid"
      data-testid="land-use-notice"
      data-mismatch={landUse.mismatch}
    >
      <Info aria-hidden="true" />
      <AlertTitle className="line-clamp-none text-base font-semibold">
        {t('grasslandTitle', { kinds })}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1 text-sm text-foreground">
        <span>{t('grasslandText')}</span>
        {grasslandHref && (
          <Link
            href={grasslandHref}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-base font-medium text-primary underline underline-offset-4 print:hidden"
          >
            <Sprout aria-hidden="true" className="size-4" />
            {t('grasslandLink')}
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
}
