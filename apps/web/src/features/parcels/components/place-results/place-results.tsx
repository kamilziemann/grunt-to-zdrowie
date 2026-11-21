import type { Place } from '@app/contracts';
import { MapPin } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslations } from 'use-intl';

export interface PlaceResultsProps {
  places: readonly Place[];
  onChoose: (place: Place) => void;
}

function PlaceItem({ place, onChoose }: { place: Place; onChoose: (place: Place) => void }) {
  const choose = useCallback(() => onChoose(place), [onChoose, place]);

  return (
    <li>
      <button
        type="button"
        onClick={choose}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:bg-secondary [@media(hover:hover)]:hover:bg-secondary/60"
      >
        <MapPin className="size-5 shrink-0 text-water" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{place.label}</span>
          {place.detail !== '' && <span className="text-sm text-muted-foreground">{place.detail}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * Wyniki szukania po adresie albo nazwie miejscowosci. Adres wskazuje okolice, nie dzialke: po wybraniu mapa
 * dojezdza na miejsce, a rolnik klika swoja dzialke (granice i numery sa wtedy widoczne).
 */
export function PlaceResults({ places, onChoose }: PlaceResultsProps) {
  const t = useTranslations('parcels.places');
  const titleId = useId();

  if (places.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2" data-testid="place-results">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-base font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {places.map((place) => (
          <PlaceItem key={place.id} place={place} onChoose={onChoose} />
        ))}
      </ul>
    </section>
  );
}
