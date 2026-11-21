import type { Parcel } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';

export interface ParcelPreviewProps {
  parcel: Parcel;
  /** dzialka jest juz na liscie "moje dzialki" */
  alreadyAdded: boolean;
  /** lista jest pelna - nie da sie dodac kolejnej */
  listFull: boolean;
  listMax: number;
  onDismiss: () => void;
}

/** Powierzchnia w hektarach: dwa miejsca dla duzych pol, cztery (1 m2) dla malych dzialek. */
export function useAreaFormatter(): (areaHa: number) => string {
  const format = useFormatter();

  return (areaHa) =>
    format.number(areaHa, { minimumFractionDigits: 2, maximumFractionDigits: areaHa < 1 ? 4 : 2 });
}

/**
 * Krok "sprawdz": opis znalezionej dzialki, zanim trafi na liste. Podglad niczego nie dodaje - decyzje podejmuje
 * rolnik przyciskiem "Dodaj do moich dzialek" w pasku akcji panelu (zawsze widoczny, takze na telefonie). Powierzchnia jest opisana jako policzona z geometrii, a nie ewidencyjna.
 */
export function ParcelPreview({ parcel, alreadyAdded, listFull, listMax, onDismiss }: ParcelPreviewProps) {
  const t = useTranslations('parcels.preview');
  const format = useFormatter();
  const formatArea = useAreaFormatter();
  const rows = [
    [t('region'), parcel.region],
    [t('commune'), parcel.commune],
    [t('county'), parcel.county],
    [t('voivodeship'), parcel.voivodeship],
    [t('id'), parcel.id],
  ].filter(([, value]) => value !== '');

  return (
    <section
      aria-labelledby="parcel-preview-title"
      data-testid="parcel-preview"
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-muted-foreground">{t('title')}</p>
        <h2 id="parcel-preview-title" className="text-xl font-semibold">
          {t('parcel', { number: parcel.number })}
        </h2>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-medium break-words">{value}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">{t('area')}</dt>
        <dd className="font-medium">{t('areaValue', { area: formatArea(parcel.areaHa) })}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        {t('areaNote')}{' '}
        {t('source', {
          source: parcel.source,
          date: format.dateTime(new Date(parcel.fetchedAt), { dateStyle: 'medium' }),
        })}
      </p>
      {alreadyAdded && <output className="block text-sm font-medium">{t('alreadyAdded')}</output>}
      {!alreadyAdded && listFull && (
        <output className="block text-sm font-medium text-warning">{t('listFull', { max: listMax })}</output>
      )}
      <Button size="xl" variant="outline" onClick={onDismiss}>
        {t('dismiss')}
      </Button>
    </section>
  );
}
