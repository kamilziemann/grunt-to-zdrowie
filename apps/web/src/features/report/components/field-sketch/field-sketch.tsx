import type { Zone } from '@app/contracts';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslations } from 'use-intl';

import type { FieldSketchModel, SketchGroup, SketchPoint } from '@/lib/field-sketch';

import { ZonePatternDefs, zoneFill, zoneStroke } from './zone-patterns';

/** Miejsce na polu do narysowania: rodzaj (wzor) i numer zgodny z lista miejsc i zaleceniami. */
export interface SketchZoneMark {
  id: string;
  kind: Zone['kind'];
  number: number;
}

export interface FieldSketchProps {
  model: FieldSketchModel;
  /** podpis pola na rysunku, np. "Działka 349/1" */
  fieldName: string;
  /** zdanie faktu przy linii odniesienia ("Rów przez pole, 428 m"); null = bez wyroznienia */
  factText: string | null;
  /** pelny opis dla czytnika ekranu */
  label: string;
  /** miejsca na polu (strefy inne niz tlo) - geometria z `model.zones`, wzor i numer stad */
  zones?: readonly SketchZoneMark[];
  /** wyrozniona strefa (zalecenie albo pozycja listy pod fokusem) */
  activeZone?: string | null;
  /** klikniecie strefy na rysunku */
  onZoneSelect?: (zoneId: string) => void;
}

const NO_MARKS: readonly SketchZoneMark[] = [];

/** Szerokosc szkicu w px, dla ktorej liczymy rozmiar napisow przed pomiarem (SSR, pierwsza klatka). */
const DEFAULT_WIDTH_PX = 576;
/** Napisy w stalych pikselach ekranu, niezaleznie od skali rysunku. */
const FONT_PX = 13;
const LABEL_FONT_PX = 14;

/** Ile jednostek viewBox przypada na piksel ekranu - napisy i grubosci linii nie maleja na telefonie. */
function useUnitsPerPixel(width: number): [RefObject<SVGSVGElement | null>, number] {
  const ref = useRef<SVGSVGElement>(null);
  const [unit, setUnit] = useState(width / DEFAULT_WIDTH_PX);

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const pixels = entry?.contentRect.width ?? 0;

      if (pixels > 0) setUnit(width / pixels);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [width]);

  return [ref, unit];
}

/** Szacunek szerokosci napisu (bez mierzenia DOM): wystarczy na tlo pod etykieta. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.56;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Prostokat zajety na rysunku: [x, y, szerokosc, wysokosc] w jednostkach viewBox. */
type Rect = readonly [number, number, number, number];

function overlaps(a: Rect, b: Rect): boolean {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

/** Prostokat napisu wysrodkowanego w punkcie (Halo: textAnchor middle, dominantBaseline middle). */
function textRect(text: string, at: SketchPoint, size: number): Rect {
  const width = textWidth(text, size);

  return [at[0] - width / 2, at[1] - size * 0.7, width, size * 1.4];
}

interface FactPlacement {
  x: number;
  y: number;
  boxWidth: number;
  boxHeight: number;
}

/**
 * Gdzie stoi ramka faktu: rowu w polu - poza polem (po stronie bez podpisu pola), zeby nie zaslaniala rowu;
 * linii wymiarowej - nad jej srodkiem. Wolne sa wszystkie rogi poza dolnym lewym (podzialka) i gornym prawym (polnoc).
 */
function placeFact({
  fact,
  text,
  font,
  unit,
  width,
  height,
  avoidY,
  fieldTop,
  fieldBottom,
  avoid = [],
}: {
  fact: NonNullable<FieldSketchModel['fact']>;
  text: string;
  font: number;
  unit: number;
  width: number;
  height: number;
  avoidY: number;
  fieldTop: number;
  fieldBottom: number;
  /** zajete miejsca (numery miejsc na polu) - ramka ich nie zaslania, gdy jest gdzie indziej miejsce */
  avoid?: readonly Rect[];
}): FactPlacement {
  const pad = 10 * unit;
  const boxWidth = textWidth(text, font) + pad * 1.6;
  const boxHeight = font * 1.8;
  const placeBox = (target: SketchPoint, preferAbove: boolean): SketchPoint => {
    const above = target[1] - boxHeight * 2.2;
    const below = target[1] + boxHeight * 2.2;
    const y = preferAbove && above > pad ? above : below < height - boxHeight - pad * 3 ? below : above;

    return [
      clamp(target[0] - boxWidth / 2, pad, width - boxWidth - pad * 4),
      clamp(y - boxHeight / 2, pad, height - boxHeight - pad * 3.5),
    ];
  };

  // pierwsza propozycja bez kolizji z numerami miejsc; gdy kazda koliduje - pierwsza
  const pick = (candidates: SketchPoint[]): FactPlacement => {
    const free = candidates.find(
      ([x, y]) => !avoid.some((rect) => overlaps([x, y, boxWidth, boxHeight], rect)),
    );
    const [x, y] = free ?? candidates[0] ?? [pad, pad];

    return { x, y, boxWidth, boxHeight };
  };

  if (fact.kind === 'ditch_through') {
    const nameBelow = avoidY > fact.anchor[1];
    const outside = nameBelow ? fieldTop - boxHeight - pad * 1.5 : fieldBottom + pad * 1.5;
    const fits = outside > pad && outside + boxHeight < height - pad * 3.5;
    const near = placeBox(fact.anchor, nameBelow);
    const x = clamp(fact.anchor[0] - boxWidth / 2, pad, width - boxWidth - pad * 4);

    return pick([
      ...(fits ? [[x, outside] as SketchPoint] : []),
      near,
      placeBox(fact.anchor, !nameBelow),
      [x, pad],
      [x, height - boxHeight - pad * 3.5],
      [width - boxWidth - pad * 4, height - boxHeight - pad * 3.5],
      [pad, pad],
    ]);
  }

  const middle: SketchPoint = [(fact.from[0] + fact.to[0]) / 2, (fact.from[1] + fact.to[1]) / 2];

  return pick([placeBox(middle, true), placeBox(middle, false)]);
}

/** Napis z obwodka w kolorze tla - czytelny na liniach i wypelnieniach, takze w czerni i bieli. */
function Halo({
  x,
  y,
  size,
  children,
  anchor = 'middle',
  weight = 600,
  italic = false,
}: {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  italic?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill="var(--foreground)"
      stroke="var(--card)"
      strokeWidth={size / 3.5}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

const LINE_STYLE: Record<
  Extract<SketchGroup, 'ditch' | 'watercourse' | 'canal'>,
  { color: string; width: number; dash?: number[] }
> = {
  ditch: { color: 'var(--sketch-ditch)', width: 1.6 },
  watercourse: { color: 'var(--sketch-stream)', width: 3.4 },
  canal: { color: 'var(--sketch-stream)', width: 2.4, dash: [7, 4] },
};

/**
 * Szkic pola w skali: obrys pola, rowy i cieki liniami (grubosc i wzor zamiast samego koloru), wody wypelnieniem,
 * mokradla kreskowaniem z przerywanym obrysem, podzialka, strzalka polnocy, podpis pola i jeden wyrozniony fakt
 * (linia odniesienia albo linia wymiarowa). Czysty SVG: ostry na wydruku, tokeny koloru dzialaja w obu motywach.
 */
export function FieldSketch({
  model,
  fieldName,
  factText,
  label,
  zones = NO_MARKS,
  activeZone = null,
  onZoneSelect,
}: FieldSketchProps) {
  const t = useTranslations('report.fieldMap.sketch');
  const id = useId();
  const [ref, unit] = useUnitsPerPixel(model.width);
  const { width, height, fact } = model;
  const font = FONT_PX * unit;
  const labelFont = LABEL_FONT_PX * unit;
  const stroke = (value: number) => value * unit;
  const pad = 10 * unit;
  const clipId = `${id}-clip`;
  const hatchId = `${id}-hatch`;
  const patternId = `${id}-zone`;
  const marks = new Map(zones.map((zone) => [zone.id, zone]));
  const drawnZones = model.zones.flatMap((shape) => {
    const mark = marks.get(shape.id);

    return mark ? [{ ...shape, ...mark }] : [];
  });

  // podpis pola pod polem (nad nim, gdy pole siega dolu rysunku)
  const fieldBottom = model.fieldCenter[1] + model.fieldSize[1] / 2;
  const fieldTop = model.fieldCenter[1] - model.fieldSize[1] / 2;
  const nameY =
    fieldBottom + labelFont * 1.3 < height - pad * 4 ? fieldBottom + labelFont * 1.1 : fieldTop - labelFont;
  const nameWidth = textWidth(fieldName, labelFont);
  const nameAt: SketchPoint = [
    clamp(model.fieldCenter[0], nameWidth / 2 + pad, width - nameWidth / 2 - pad),
    nameY,
  ];
  const placement =
    fact && factText
      ? placeFact({
          fact,
          text: factText,
          font: labelFont,
          unit,
          width,
          height,
          avoidY: nameAt[1],
          fieldTop,
          fieldBottom,
          avoid: [
            textRect(fieldName, nameAt, labelFont),
            ...drawnZones.map((zone) => badgeRect(zone.labelAt, unit)),
          ],
        })
      : null;
  // nazwy ciekow ustepuja podpisowi pola, ramce faktu, podzialce, polnocy i sobie nawzajem - pominieta nazwa
  // zostaje w legendzie pod szkicem
  const taken: Rect[] = [
    textRect(fieldName, nameAt, labelFont),
    [0, height - 12 * unit - 6 * unit - font * 1.6, model.scale.length + 24 * unit, height],
    [width - pad * 4, 0, pad * 4, pad * 1.6 + 18 * unit + font * 1.6],
    ...(placement ? [[placement.x, placement.y, placement.boxWidth, placement.boxHeight] as const] : []),
  ];
  const names = model.names.filter((name) => {
    const rect = textRect(name.text, name.at, font);

    if (taken.some((other) => overlaps(rect, other))) return false;
    taken.push(rect);

    return true;
  });

  // rysunek jest ozdoba dla czytnika ekranu - tresc niesie zdanie obok (i podpis pod szkicem)
  return (
    <>
      <p className="sr-only" data-testid="field-sketch-label">
        {label}
      </p>
      <svg
        ref={ref}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        aria-hidden="true"
        className="block h-auto w-full font-sans"
        data-testid="field-sketch"
      >
        <defs>
          <clipPath id={clipId}>
            <rect width={width} height={height} />
          </clipPath>
          <pattern
            id={hatchId}
            width={stroke(7)}
            height={stroke(7)}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={stroke(7)}
              stroke="var(--sketch-wetland)"
              strokeWidth={stroke(1.4)}
            />
          </pattern>
          <ZonePatternDefs prefix={patternId} unit={unit} />
        </defs>
        <rect width={width} height={height} fill="var(--card)" />
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {model.areas.map((area, index) =>
            area.group === 'wetland' ? (
              <path
                key={`a${String(index)}`}
                d={area.d}
                fill={`url(#${hatchId})`}
                fillRule="evenodd"
                stroke="var(--sketch-wetland)"
                strokeWidth={stroke(1.2)}
                strokeDasharray={`${String(stroke(5))} ${String(stroke(3))}`}
                data-group="wetland"
              />
            ) : (
              <path
                key={`a${String(index)}`}
                d={area.d}
                fill="var(--sketch-water)"
                fillRule="evenodd"
                stroke="var(--sketch-stream)"
                strokeWidth={stroke(1)}
                data-group={area.group}
              />
            ),
          )}
          <path d={model.field} fill="var(--sketch-field-fill)" fillRule="evenodd" stroke="none" />
          {drawnZones.map((zone) => (
            <ZoneShape
              key={zone.id}
              zone={zone}
              fill={zone.line ? 'none' : zoneFill(patternId, zone.kind)}
              unit={unit}
              dimmed={activeZone !== null && activeZone !== zone.id}
              onSelect={onZoneSelect}
            />
          ))}
          {model.lines.map((line, index) => {
            const style =
              LINE_STYLE[line.group === 'ditch' || line.group === 'canal' ? line.group : 'watercourse'];

            return (
              <g key={`l${String(index)}`} data-group={line.group}>
                <path
                  d={line.d}
                  fill="none"
                  stroke="var(--card)"
                  strokeWidth={stroke(style.width + 2.5)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={line.d}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={stroke(style.width)}
                  strokeDasharray={style.dash?.map(stroke).join(' ')}
                  strokeLinecap={style.dash ? 'butt' : 'round'}
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {model.highlight && (
            <path
              d={model.highlight}
              fill="none"
              stroke="var(--sketch-highlight)"
              strokeWidth={stroke(4.5)}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="field-sketch-highlight"
            />
          )}
          <path
            d={model.field}
            fill="none"
            stroke="var(--sketch-field)"
            strokeWidth={stroke(2.6)}
            strokeLinejoin="round"
            data-testid="field-sketch-field"
          />
          {drawnZones
            .filter((zone) => zone.id === activeZone)
            .map((zone) => (
              <path
                key={zone.id}
                d={zone.d}
                fill="none"
                stroke="var(--sketch-highlight)"
                strokeWidth={stroke(3.5)}
                strokeLinejoin="round"
                pointerEvents="none"
                data-testid="field-sketch-zone-active"
              />
            ))}
          {names.map((name) => (
            <Halo key={name.text} x={name.at[0]} y={name.at[1]} size={font} weight={500} italic>
              {name.text}
            </Halo>
          ))}
        </g>
        <g aria-hidden="true">
          <Halo x={nameAt[0]} y={nameAt[1]} size={labelFont} weight={700}>
            {fieldName}
          </Halo>
          {fact && factText && placement && (
            <FactCallout fact={fact} text={factText} font={labelFont} unit={unit} placement={placement} />
          )}
          <ScaleBar
            meters={model.scale.meters}
            length={model.scale.length}
            height={height}
            unit={unit}
            font={font}
          />
          <NorthArrow x={width - pad * 2.4} y={pad * 1.6} unit={unit} font={font} label={t('north')} />
          {drawnZones.map((zone) => (
            <ZoneBadge
              key={zone.id}
              zoneId={zone.id}
              at={zone.labelAt}
              number={zone.number}
              unit={unit}
              active={zone.id === activeZone}
              onSelect={onZoneSelect}
            />
          ))}
        </g>
      </svg>
    </>
  );
}

/** Obszar (albo linia splywu) miejsca na polu: wzor rodzaju, obrys; przygaszony, gdy wyrozniono inne miejsce. */
function ZoneShape({
  zone,
  fill,
  unit,
  dimmed,
  onSelect,
}: {
  zone: SketchZoneMark & { d: string; line: boolean };
  fill: string;
  unit: number;
  dimmed: boolean;
  onSelect?: (zoneId: string) => void;
}) {
  const select = useCallback(() => onSelect?.(zone.id), [onSelect, zone.id]);
  const dashed = zone.line || zone.kind === 'segment';

  return (
    <path
      d={zone.d}
      fill={fill}
      fillRule="evenodd"
      stroke={zoneStroke(zone.kind)}
      strokeWidth={(zone.line ? 3 : 1.2) * unit}
      strokeDasharray={dashed ? `${String(5 * unit)} ${String(3 * unit)}` : undefined}
      strokeLinejoin="round"
      opacity={dimmed ? 0.45 : 1}
      className={onSelect ? 'cursor-pointer' : undefined}
      onClick={onSelect ? select : undefined}
      data-zone={zone.id}
      data-kind={zone.kind}
    />
  );
}

/** Prostokat numeru miejsca (kolko z obwodka) z zapasem. */
function badgeRect(at: SketchPoint, unit: number): Rect {
  const size = 12 * unit;

  return [at[0] - size, at[1] - size, size * 2, size * 2];
}

/** Numer miejsca w kolku - staly rozmiar na ekranie, czytelny na kazdym wzorze i w czerni i bieli. */
function ZoneBadge({
  zoneId,
  at,
  number,
  unit,
  active,
  onSelect,
}: {
  zoneId: string;
  at: SketchPoint;
  number: number;
  unit: number;
  active: boolean;
  onSelect?: (zoneId: string) => void;
}) {
  const radius = 9 * unit;
  const select = useCallback(() => onSelect?.(zoneId), [onSelect, zoneId]);

  return (
    <g
      className={onSelect ? 'cursor-pointer' : undefined}
      onClick={onSelect ? select : undefined}
      data-testid="field-sketch-zone-number"
    >
      <circle
        cx={at[0]}
        cy={at[1]}
        r={radius}
        fill={active ? 'var(--sketch-highlight)' : 'var(--foreground)'}
        stroke="var(--card)"
        strokeWidth={2 * unit}
      />
      <text
        x={at[0]}
        y={at[1]}
        fontSize={12 * unit}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--card)"
      >
        {number}
      </text>
    </g>
  );
}

/** Fakt z raportu: linia odniesienia do rowu w polu albo linia wymiarowa do najblizszego obiektu. */
function FactCallout({
  fact,
  text,
  font,
  unit,
  placement,
}: {
  fact: NonNullable<FieldSketchModel['fact']>;
  text: string;
  font: number;
  unit: number;
  placement: FactPlacement;
}) {
  const pad = 10 * unit;
  const { x, y, boxWidth, boxHeight } = placement;

  if (fact.kind === 'ditch_through') {
    const joinY = y + boxHeight / 2 < fact.anchor[1] ? y + boxHeight : y;

    return (
      <g data-testid="field-sketch-fact">
        <line
          x1={clamp(fact.anchor[0], x + pad, x + boxWidth - pad)}
          y1={joinY}
          x2={fact.anchor[0]}
          y2={fact.anchor[1]}
          stroke="var(--foreground)"
          strokeWidth={1.4 * unit}
        />
        <circle cx={fact.anchor[0]} cy={fact.anchor[1]} r={3.5 * unit} fill="var(--foreground)" />
        <FactBox x={x} y={y} width={boxWidth} height={boxHeight} font={font} unit={unit} text={text} />
      </g>
    );
  }

  const middle: SketchPoint = [(fact.from[0] + fact.to[0]) / 2, (fact.from[1] + fact.to[1]) / 2];
  const tick = 4 * unit;

  return (
    <g data-testid="field-sketch-fact">
      <line
        x1={fact.from[0]}
        y1={fact.from[1]}
        x2={fact.to[0]}
        y2={fact.to[1]}
        stroke="var(--foreground)"
        strokeWidth={1.4 * unit}
        strokeDasharray={`${String(4 * unit)} ${String(3 * unit)}`}
      />
      <circle cx={fact.from[0]} cy={fact.from[1]} r={tick * 0.8} fill="var(--foreground)" />
      <circle cx={fact.to[0]} cy={fact.to[1]} r={tick * 0.8} fill="var(--foreground)" />
      <line
        x1={middle[0]}
        y1={middle[1]}
        x2={clamp(middle[0], x + pad, x + boxWidth - pad)}
        y2={y + boxHeight / 2 < middle[1] ? y + boxHeight : y}
        stroke="var(--foreground)"
        strokeWidth={1 * unit}
      />
      <FactBox x={x} y={y} width={boxWidth} height={boxHeight} font={font} unit={unit} text={text} />
    </g>
  );
}

function FactBox({
  x,
  y,
  width,
  height,
  font,
  unit,
  text,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  font: number;
  unit: number;
  text: string;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4 * unit}
        fill="var(--card)"
        stroke="var(--sketch-highlight)"
        strokeWidth={2 * unit}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        fontSize={font}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--foreground)"
      >
        {text}
      </text>
    </>
  );
}

function ScaleBar({
  meters,
  length,
  height,
  unit,
  font,
}: {
  meters: number;
  length: number;
  height: number;
  unit: number;
  font: number;
}) {
  const x = 12 * unit;
  const y = height - 12 * unit;
  const tick = 6 * unit;

  return (
    <g data-testid="field-sketch-scale">
      <path
        d={`M${String(x)} ${String(y - tick)}V${String(y)}H${String(x + length)}V${String(y - tick)}`}
        fill="none"
        stroke="var(--card)"
        strokeWidth={5 * unit}
        strokeLinejoin="round"
      />
      <path
        d={`M${String(x)} ${String(y - tick)}V${String(y)}H${String(x + length)}V${String(y - tick)}`}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={2 * unit}
      />
      <Halo x={x + length / 2} y={y - tick - font * 0.4} size={font} weight={600}>
        {`${String(meters)} m`}
      </Halo>
    </g>
  );
}

function NorthArrow({
  x,
  y,
  unit,
  font,
  label,
}: {
  x: number;
  y: number;
  unit: number;
  font: number;
  label: string;
}) {
  const size = 9 * unit;

  return (
    <g data-testid="field-sketch-north">
      <path
        d={`M${String(x)} ${String(y)}l${String(size * 0.7)} ${String(size * 2)}l${String(-size * 0.7)} ${String(-size * 0.55)}l${String(-size * 0.7)} ${String(size * 0.55)}Z`}
        fill="var(--foreground)"
        stroke="var(--card)"
        strokeWidth={1.5 * unit}
        strokeLinejoin="round"
      />
      <Halo x={x} y={y + size * 2 + font * 0.9} size={font} weight={700}>
        {label}
      </Halo>
    </g>
  );
}
