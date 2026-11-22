import type { ContextLayer, ImageryLayer } from '@app/contracts';
import { useId } from 'react';

import type { VegetationImagery } from '../../api/imagery.queries';
import type { ImageryState } from '../../hooks/use-vegetation-imagery';
import { ContextLegend } from '../context-legend';
import { HydroLegend } from '../hydro-legend';
import { ImageryLegend } from '../imagery-legend';
import type { ContextVisibility, HydroStatus, LayerStatus } from '../parcel-map';

export interface MapLegendsProps {
  /** stan warstwy rowow; `null` = legenda niepokazana */
  hydroStatus: HydroStatus | null;
  /** wlaczone warstwy otoczenia; `null` = legenda niepokazana */
  contextEnabled: ContextVisibility | null;
  contextStatuses: Readonly<Record<ContextLayer, LayerStatus>>;
  /** warstwa zdjecia z satelity; `null` = legenda niepokazana */
  imageryLayer: ImageryLayer | null;
  imageryState: ImageryState;
  imageryData: VegetationImagery | null;
  imageryRequestedDate: string;
  onImageryRetry: () => void;
  /** wyglad pojedynczej legendy (np. pelna szerokosc w panelu na telefonie) */
  itemClassName?: string;
}

/**
 * Legendy wlaczonych warstw jako harmonijka: wspolny atrybut `name` na `<details>` sprawia, ze rozwiniecie jednej
 * legendy zwija poprzednia (natywnie w Chromium, Firefoksie i WebKit). Domyslnie wszystkie zwiniete; stan warstwy
 * (przybliz, niedostepna, brak zdjecia) kazda legenda pokazuje takze po zwinieciu.
 */
export function MapLegends({
  hydroStatus,
  contextEnabled,
  contextStatuses,
  imageryLayer,
  imageryState,
  imageryData,
  imageryRequestedDate,
  onImageryRetry,
  itemClassName,
}: MapLegendsProps) {
  const group = useId();

  return (
    <>
      {hydroStatus && <HydroLegend status={hydroStatus} group={group} className={itemClassName} />}
      {contextEnabled && (
        <ContextLegend
          enabled={contextEnabled}
          statuses={contextStatuses}
          group={group}
          className={itemClassName}
        />
      )}
      {imageryLayer && (
        <ImageryLegend
          layer={imageryLayer}
          state={imageryState}
          data={imageryData}
          requestedDate={imageryRequestedDate}
          onRetry={onImageryRetry}
          group={group}
          className={itemClassName}
        />
      )}
    </>
  );
}
