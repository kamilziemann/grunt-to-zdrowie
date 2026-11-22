import type { ImageryLayer, ParcelGeometry, VegetationImagery, WaterReport } from '@app/contracts';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useMemo, type CSSProperties } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import { imageryProblem, reportImageryQuery, type ImageryProblem } from '../../api/imagery.queries';
import { ZoneBadge } from '../field-sketch';
import { useZoneFocus } from '../zone-focus';
import { imageryRequest, useSatellitePrint } from './satellite-print';

/** Paski skali tymi samymi tokenami co kolory PNG z API (`--vegetation-*`, `--moisture-*`). */
export const SATELLITE_GRADIENTS: Record<ImageryLayer, string> = {
  condition: 'from-(--vegetation-low) via-(--vegetation-mid) to-(--vegetation-high)',
  moisture: 'from-(--moisture-low) via-(--moisture-mid) to-(--moisture-high)',
};

/** Ponizej tej czesci pola bez chmur mowimy, ze czesc pola nie ma koloru. */
export const CLEAR_ENOUGH = 0.9;

const LAYERS: readonly ImageryLayer[] = ['condition', 'moisture'];

export type ImageState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: VegetationImagery }
  | { kind: ImageryProblem };

/**
 * "Pole z satelity" na wydruku (w sekcji "Ocena" pelnej analizy): dwa obrazy dzialki z dnia analizy - "Kondycja
 * roslin" i "Woda w roslinach" - z obrysem pola, skala opisana slowami, data zdjecia i zastrzezeniami (kwadrat
 * 10-20 m, jedno zdjecie, wilgotnosc roslin a nie gleby, skala porownuje miejsca w polu). Na ekranie te obrazy sa
 * trybami karty "Twoje pole", wiec tu blok jest tylko na papierze; obrazy pobiera "Zapisz PDF"
 * (`useSatellitePrint`). Pole bez dzialek, brak czystego zdjecia albo kluczy = jedno zdanie zamiast pustych ramek.
 */
export function SatelliteSection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.satellite');
  const { requested } = useSatellitePrint();
  const target = imageryRequest(report);

  return (
    <section
      aria-labelledby="satelita-title"
      className="hidden flex-col gap-3 print:flex"
      data-testid="satellite-section"
    >
      <h3 id="satelita-title" className="text-xl font-semibold print:break-after-avoid">
        {t('title')}
      </h3>
      <div className="flex flex-col gap-4">
        {!target ? (
          <p className="text-base" data-testid="satellite-none">
            {t('noParcels')}
          </p>
        ) : requested ? (
          <SatelliteImages report={report} dzialki={target.dzialki} date={target.date} />
        ) : (
          // Ctrl+P bez przycisku "Zapisz PDF": zdjec jeszcze nie ma, wiec na wydruku zdanie, jak je dolaczyc
          <p className="text-base" data-testid="satellite-not-loaded">
            {t('notLoaded')}
          </p>
        )}
      </div>
    </section>
  );
}

function SatelliteImages({ report, dzialki, date }: { report: WaterReport; dzialki: string; date: string }) {
  const t = useTranslations('report.satellite');
  const format = useFormatter();
  const condition = useQuery(reportImageryQuery(dzialki, date, 'condition'));
  const moisture = useQuery(reportImageryQuery(dzialki, date, 'moisture'));
  const states: Record<ImageryLayer, ImageState> = {
    condition: stateOf(condition),
    moisture: stateOf(moisture),
  };
  const refetchCondition = condition.refetch;
  const refetchMoisture = moisture.refetch;
  const retry = useCallback(() => {
    void refetchCondition();
    void refetchMoisture();
  }, [refetchCondition, refetchMoisture]);
  const day = format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'long', timeZone: APP_TIME_ZONE });
  const problems = LAYERS.map((layer) => states[layer].kind);
  const sameProblem =
    problems[0] === problems[1] && problems[0] !== 'ready' && problems[0] !== 'loading' ? problems[0] : null;

  // oba obrazy maja ten sam problem (zwykle chmury albo brak kluczy) - jedno zdanie zamiast dwoch ramek
  if (sameProblem) {
    return <ProblemNote problem={sameProblem} day={day} onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="satellite-images">
      <p className="text-base">{t('intro')}</p>
      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
        {LAYERS.map((layer) => (
          <SatelliteFigure
            key={layer}
            layer={layer}
            state={states[layer]}
            field={report.field.geometry}
            day={day}
            onRetry={retry}
          />
        ))}
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground print:break-inside-avoid">
        <li>{t('limits.pixel')}</li>
        <li>{t('limits.oneDay')}</li>
        <li>{t('limits.plantsNotSoil')}</li>
        <li>{t('limits.relative')}</li>
        <li>{t('limits.colour')}</li>
      </ul>
    </div>
  );
}

export function stateOf(query: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data?: VegetationImagery;
}) {
  if (query.data) return { kind: 'ready', data: query.data } as const;

  if (query.isError) return { kind: imageryProblem(query.error) } as const;

  return { kind: 'loading' } as const;
}

export function ProblemNote({
  problem,
  day,
  onRetry,
}: {
  problem: ImageryProblem;
  day: string;
  onRetry: () => void;
}) {
  const t = useTranslations('report.satellite');
  const tCommon = useTranslations('common');

  return (
    <div className="flex flex-col items-start gap-2" data-testid="satellite-problem" data-problem={problem}>
      <p className="text-base">{t(`problem.${problem}`, { date: day })}</p>
      {problem === 'busy' && (
        <Button variant="outline" onClick={onRetry} className="print:hidden">
          {tCommon('tryAgain')}
        </Button>
      )}
    </div>
  );
}

/** Rzut prostokata zdjecia na kadr: lewy gorny rog i rozmiar w procentach kadru. */
function placement(
  [west, south, east, north]: readonly [number, number, number, number],
  frame: VegetationImagery['bbox'],
) {
  const [fw, fs, fe, fn] = frame;
  const width = fe - fw || 1;
  const height = fn - fs || 1;

  return {
    left: ((west - fw) / width) * 100,
    top: ((fn - north) / height) * 100,
    width: ((east - west) / width) * 100,
    height: ((north - south) / height) * 100,
  };
}

/** Obrys pola w ukladzie kadru 0-100 (SVG nad zdjeciem, bez zachowania proporcji - kadr ma je juz dobre). */
function outline(geometry: ParcelGeometry, frame: VegetationImagery['bbox']): string {
  const [fw, fs, fe, fn] = frame;
  const width = fe - fw || 1;
  const height = fn - fs || 1;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  return polygons
    .flat()
    .map(
      (ring) =>
        `M${ring
          .map(([lng, lat]) => `${String(((lng - fw) / width) * 100)} ${String(((fn - lat) / height) * 100)}`)
          .join('L')}Z`,
    )
    .join('');
}

function SatelliteFigure({
  layer,
  state,
  field,
  day,
  onRetry,
}: {
  layer: ImageryLayer;
  state: ImageState;
  field: ParcelGeometry;
  day: string;
  onRetry: () => void;
}) {
  const t = useTranslations('report.satellite');
  const format = useFormatter();
  const data = state.kind === 'ready' ? state.data : null;
  const sceneDay = data
    ? format.dateTime(new Date(`${data.sceneDate}T12:00:00Z`), { dateStyle: 'long', timeZone: APP_TIME_ZONE })
    : null;
  const value = (number: number) => format.number(number, { maximumFractionDigits: 2 });

  return (
    <figure
      className="flex flex-col gap-2 rounded-2xl border p-3 print:break-inside-avoid print:p-2"
      data-testid={`satellite-${layer}`}
      data-state={state.kind}
    >
      <h4 className="text-lg font-semibold">{t(`layers.${layer}.title`)}</h4>
      <p className="text-sm text-muted-foreground">{t(`layers.${layer}.what`)}</p>
      {state.kind === 'loading' ? (
        <output className="flex items-start gap-2 text-base" data-testid="satellite-loading">
          <LoaderCircle aria-hidden="true" className="mt-1 size-4 shrink-0 animate-spin text-primary" />
          {t('loading')}
        </output>
      ) : state.kind === 'ready' ? (
        data && (
          <>
            <SatelliteFrame data={data} field={field} label={t(`layers.${layer}.alt`)} />
            <SatelliteScale layer={layer} />
            <figcaption className="flex flex-col gap-1 text-sm">
              <span>{t('scene', { date: sceneDay ?? '' })}</span>
              {data.clearShare < CLEAR_ENOUGH && <span className="text-muted-foreground">{t('clouds')}</span>}
              <span className="text-muted-foreground">
                {t(`layers.${layer}.advisor`, { low: value(data.scale.low), high: value(data.scale.high) })}
              </span>
            </figcaption>
          </>
        )
      ) : (
        <ProblemNote problem={state.kind} day={day} onRetry={onRetry} />
      )}
    </figure>
  );
}

export interface SatelliteZoneMark {
  id: string;
  number: number;
  /** punkt na numer (dlugosc, szerokosc) */
  at: readonly [number, number];
}

const NO_MARKS: readonly SatelliteZoneMark[] = [];

/**
 * Obraz z satelity w kadrze o proporcjach terenu, z obrysem pola i - gdy podane - numerami miejsc na polu (te same
 * przyciski co na szkicu: klikniecie wybiera miejsce, drugie odznacza). Kafel PNG z API rysujemy w pikselach.
 */
export function SatelliteFrame({
  data,
  field,
  label,
  zones = NO_MARKS,
  className,
}: {
  data: VegetationImagery;
  field: ParcelGeometry;
  label: string;
  zones?: readonly SatelliteZoneMark[];
  className?: string;
}) {
  const t = useTranslations('report.fieldMap.sketch');
  const { active, selected, toggle } = useZoneFocus();
  const frameStyle = useMemo((): CSSProperties => {
    const [west, south, east, north] = data.bbox;
    const middle = (((south + north) / 2) * Math.PI) / 180;
    // proporcje kadru w metrach (stopien dlugosci jest krotszy niz szerokosci)
    const ratio = ((east - west) * Math.cos(middle)) / (north - south || 1);

    return { aspectRatio: String(Math.min(2.2, Math.max(0.6, ratio))) };
  }, [data]);
  const path = useMemo(() => outline(field, data.bbox), [data, field]);
  const [fw, fs, fe, fn] = data.bbox;

  return (
    <div className={cn('relative w-full overflow-hidden rounded-lg bg-muted', className)} style={frameStyle}>
      {data.images.map((image, index) => (
        <PlacedImage
          key={image.image.slice(-32)}
          image={image}
          frame={data.bbox}
          label={index === 0 ? label : ''}
        />
      ))}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        <path d={path} fill="none" stroke="var(--card)" strokeWidth="5" vectorEffect="non-scaling-stroke" />
        <path
          d={path}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {zones.map((zone) => (
        <ZoneBadge
          key={zone.id}
          zoneId={zone.id}
          left={((zone.at[0] - fw) / (fe - fw || 1)) * 100}
          top={((fn - zone.at[1]) / (fn - fs || 1)) * 100}
          number={zone.number}
          active={zone.id === active}
          pressed={zone.id === selected}
          label={t('zoneButton', { number: zone.number })}
          onSelect={toggle}
          testId="satellite-zone-number"
        />
      ))}
    </div>
  );
}

/** Skala obrazu slowami (np. "slabiej - lepiej") z paskiem kolorow jak na obrazie. */
export function SatelliteScale({ layer }: { layer: ImageryLayer }) {
  const t = useTranslations('report.satellite');

  return (
    <div className="flex flex-col gap-1" data-testid="satellite-scale">
      <div aria-hidden="true" className={cn('h-3 rounded-full bg-linear-to-r', SATELLITE_GRADIENTS[layer])} />
      <p className="flex justify-between text-base font-medium">
        <span>{t(`layers.${layer}.low`)}</span>
        <span>{t(`layers.${layer}.high`)}</span>
      </p>
    </div>
  );
}

function PlacedImage({
  image,
  frame,
  label,
}: {
  image: VegetationImagery['images'][number];
  frame: VegetationImagery['bbox'];
  label: string;
}) {
  const style = useMemo((): CSSProperties => {
    const box = placement(image.bbox, frame);

    return {
      left: `${String(box.left)}%`,
      top: `${String(box.top)}%`,
      width: `${String(box.width)}%`,
      height: `${String(box.height)}%`,
    };
  }, [image.bbox, frame]);

  return (
    <img
      src={image.image}
      alt={label}
      className="absolute max-w-none [image-rendering:pixelated]"
      style={style}
      data-satellite-image=""
    />
  );
}
