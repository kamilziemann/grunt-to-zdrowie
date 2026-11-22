import type { ImageryLayer, ParcelGeometry, VegetationImagery, WaterReport } from '@app/contracts';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { APP_TIME_ZONE } from '@/lib/locale';
import { cn } from '@/lib/utils/cn';

import { imageryProblem, reportImageryQuery, type ImageryProblem } from '../../api/imagery.queries';
import { imageryRequest, useSatellitePrint } from './satellite-print';

/** Paski skali tymi samymi tokenami co kolory PNG z API (`--vegetation-*`, `--moisture-*`). */
const GRADIENTS: Record<ImageryLayer, string> = {
  condition: 'from-(--vegetation-low) via-(--vegetation-mid) to-(--vegetation-high)',
  moisture: 'from-(--moisture-low) via-(--moisture-mid) to-(--moisture-high)',
};

/** Ponizej tej czesci pola bez chmur mowimy, ze czesc pola nie ma koloru. */
const CLEAR_ENOUGH = 0.9;

const LAYERS: readonly ImageryLayer[] = ['condition', 'moisture'];

type ImageState = { kind: 'loading' } | { kind: 'ready'; data: VegetationImagery } | { kind: ImageryProblem };

/** Kotwica bloku (`#satelita` otwiera go od razu). */
const ANCHOR = 'satelita';

/**
 * "Pole z satelity" (w sekcji "Ocena" pelnej analizy): dwa obrazy dzialki z dnia analizy - "Kondycja roslin"
 * i "Woda w roslinach" - z obrysem pola, skala opisana slowami, data zdjecia i zastrzezeniami (kwadrat 10-20 m,
 * jedno zdjecie, wilgotnosc roslin a nie gleby, skala porownuje miejsca w polu). Blok jest zwiniety; obrazy
 * pobieramy dopiero po rozwinieciu albo przed wydrukiem (`useSatellitePrint`). Pole bez dzialek, brak czystego
 * zdjecia albo kluczy = jedno zdanie zamiast pustych ramek.
 */
export function SatelliteSection({ report }: { report: WaterReport }) {
  const t = useTranslations('report.satellite');
  const { requested, request } = useSatellitePrint();
  const target = imageryRequest(report);
  // raport rysuje sie w przegladarce (analiza liczy sie po stronie klienta); kotwica w adresie otwiera blok
  const [open] = useState(() => typeof window !== 'undefined' && window.location.hash === `#${ANCHOR}`);

  useEffect(() => {
    if (open) request();
  }, [open, request]);

  const onToggle = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      if (event.currentTarget.open) request();
    },
    [request],
  );

  return (
    <details
      id={ANCHOR}
      open={open}
      onToggle={onToggle}
      className="group scroll-mt-28 rounded-2xl border print:border-0"
      data-testid="satellite-section"
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden print:min-h-0 print:px-0 print:py-1">
        <span className="flex flex-col gap-0.5">
          <h3 className="text-xl font-semibold print:break-after-avoid">{t('title')}</h3>
          <span className="text-base text-muted-foreground print:hidden">{t('summary')}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-6 shrink-0 transition-transform duration-200 group-open:rotate-180 print:hidden"
        />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4 print:px-0 print:pb-0">
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
    </details>
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

function stateOf(query: { isPending: boolean; isError: boolean; error: unknown; data?: VegetationImagery }) {
  if (query.data) return { kind: 'ready', data: query.data } as const;

  if (query.isError) return { kind: imageryProblem(query.error) } as const;

  return { kind: 'loading' } as const;
}

function ProblemNote({
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
  const frameStyle = useMemo((): CSSProperties | undefined => {
    if (!data) return undefined;
    const [west, south, east, north] = data.bbox;
    const middle = (((south + north) / 2) * Math.PI) / 180;
    // proporcje kadru w metrach (stopien dlugosci jest krotszy niz szerokosci)
    const ratio = ((east - west) * Math.cos(middle)) / (north - south || 1);

    return { aspectRatio: String(Math.min(2.2, Math.max(0.6, ratio))) };
  }, [data]);
  const path = useMemo(() => (data ? outline(field, data.bbox) : ''), [data, field]);
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
            <div className="relative w-full overflow-hidden rounded-lg bg-muted" style={frameStyle}>
              {data.images.map((image, index) => (
                <PlacedImage
                  key={image.image.slice(-32)}
                  image={image}
                  frame={data.bbox}
                  label={index === 0 ? t(`layers.${layer}.alt`) : ''}
                />
              ))}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute inset-0 size-full"
              >
                <path
                  d={path}
                  fill="none"
                  stroke="var(--card)"
                  strokeWidth="5"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div aria-hidden="true" className={cn('h-3 rounded-full bg-linear-to-r', GRADIENTS[layer])} />
            <p className="flex justify-between text-sm font-medium">
              <span>{t(`layers.${layer}.low`)}</span>
              <span>{t(`layers.${layer}.high`)}</span>
            </p>
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
