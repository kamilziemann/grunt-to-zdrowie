// Tryby "Kondycja roslin" i "Woda w roslinach" karty "Twoje pole": obraz dzialki z satelity z dnia analizy (z obrysem
// pola i numerami miejsc) po lewej, skala slowami, data zdjecia i zastrzezenia w kolumnie objasnien. Obraz pobiera
// dopiero wybor trybu (to samo zapytanie i klucz cache co blok "Pole z satelity" na wydruku i mapa dzialek).
import type { FieldArea, ImageryLayer } from '@app/contracts';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, PenLine } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { APP_TIME_ZONE } from '@/lib/locale';

import { reportImageryQuery, type ImageryProblem } from '../../api/imagery.queries';
import type { NumberedZone } from '../../utils/report-data';
import {
  CLEAR_ENOUGH,
  ProblemNote,
  SatelliteFrame,
  SatelliteScale,
  stateOf,
  type ImageState,
  type SatelliteZoneMark,
} from '../satellite-section';
import { chooseFieldMode } from './field-mode';
import { zoneLabelPosition } from './zone-layers';

/** Obraz z satelity dla dzialek raportu; `parcels` = null to wlasny obrys bez dzialek - obrazu nie ma. */
export interface SatelliteTarget {
  parcels: string | null;
  date: string;
}

type SatelliteState = ImageState | { kind: 'noParcels' };

/** Stan obrazu wybranej warstwy; zapytanie rusza dopiero, gdy warstwa jest wybrana. */
export function useSatelliteLayer(
  target: SatelliteTarget,
  layer: ImageryLayer | null,
): { state: SatelliteState; retry: () => void } {
  const enabled = target.parcels !== null && layer !== null;
  const query = useQuery({
    ...reportImageryQuery(target.parcels ?? '', target.date, layer ?? 'condition'),
    enabled,
  });
  const { refetch } = query;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { state: target.parcels === null ? { kind: 'noParcels' } : stateOf(query), retry };
}

function day(format: ReturnType<typeof useFormatter>, date: string): string {
  return format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'long', timeZone: APP_TIME_ZONE });
}

/** Lewa czesc karty w trybie satelitarnym: obraz albo jedno zdanie i powrot do szkicu. */
export function SatelliteImage({
  layer,
  state,
  field,
  zones,
  date,
  onRetry,
}: {
  layer: ImageryLayer;
  state: SatelliteState;
  field: FieldArea;
  zones: readonly NumberedZone[];
  date: string;
  onRetry: () => void;
}) {
  const t = useTranslations('report.satellite');
  const format = useFormatter();
  const marks = useMemo(
    (): SatelliteZoneMark[] =>
      zones.map(({ zone, number }) => ({ id: zone.id, number, at: zoneLabelPosition(zone.geometry) })),
    [zones],
  );

  if (state.kind === 'ready') {
    return (
      <SatelliteFrame
        data={state.data}
        field={field.geometry}
        label={t(`layers.${layer}.alt`)}
        zones={marks}
        className="rounded-2xl border"
      />
    );
  }

  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border bg-muted px-6 py-10 text-center sm:min-h-96"
      data-testid="field-satellite-state"
      data-state={state.kind}
    >
      {state.kind === 'loading' ? (
        <output className="flex items-start gap-2 text-lg">
          <LoaderCircle aria-hidden="true" className="mt-1 size-5 shrink-0 animate-spin text-primary" />
          {t('loading')}
        </output>
      ) : state.kind === 'noParcels' ? (
        <p className="max-w-md text-lg">{t('noParcels')}</p>
      ) : (
        <ProblemNote
          problem={state.kind satisfies ImageryProblem}
          day={day(format, date)}
          onRetry={onRetry}
        />
      )}
      {state.kind !== 'loading' && <BackToSketch />}
    </div>
  );
}

function BackToSketch() {
  const t = useTranslations('report.fieldMap');
  const back = useCallback(() => chooseFieldMode('sketch'), []);

  return (
    <Button type="button" variant="outline" size="xl" onClick={back} data-testid="field-satellite-back">
      <PenLine aria-hidden="true" />
      {t('backToSketch')}
    </Button>
  );
}

/** Kolumna objasnien w trybie satelitarnym: co pokazuje obraz, skala slowami, data zdjecia i zastrzezenia. */
export function SatelliteNotes({ layer, state }: { layer: ImageryLayer; state: SatelliteState }) {
  const t = useTranslations('report.satellite');
  const format = useFormatter();
  const value = (number: number) => format.number(number, { maximumFractionDigits: 2 });
  const data = state.kind === 'ready' ? state.data : null;

  return (
    <div
      className="flex flex-col gap-3 print:hidden"
      data-testid="field-satellite-notes"
      data-layer={layer}
      data-state={state.kind}
    >
      <h3 className="text-lg font-semibold">{t(`layers.${layer}.title`)}</h3>
      <p className="text-base">{t(`layers.${layer}.what`)}</p>
      {data && (
        <>
          <SatelliteScale layer={layer} />
          <p className="text-base font-medium">{t('scene', { date: day(format, data.sceneDate) })}</p>
          {data.clearShare < CLEAR_ENOUGH && <p className="text-base">{t('clouds')}</p>}
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>{t('limits.pixel')}</li>
            <li>{t('limits.oneDay')}</li>
            {layer === 'moisture' && <li>{t('limits.plantsNotSoil')}</li>}
            <li>{t('limits.relative')}</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            {t(`layers.${layer}.advisor`, { low: value(data.scale.low), high: value(data.scale.high) })}
          </p>
        </>
      )}
    </div>
  );
}
