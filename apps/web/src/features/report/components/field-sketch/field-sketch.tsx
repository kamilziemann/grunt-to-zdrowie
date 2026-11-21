import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslations } from 'use-intl';

import type { FieldSketchModel, SketchGroup, SketchPoint } from '@/lib/field-sketch';

export interface FieldSketchProps {
  model: FieldSketchModel;
  /** podpis pola na rysunku, np. "Działka 349/1" */
  fieldName: string;
  /** zdanie faktu przy linii odniesienia ("Rów przez pole, 428 m"); null = bez wyroznienia */
  factText: string | null;
  /** pelny opis dla czytnika ekranu */
  label: string;
}

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
export function FieldSketch({ model, fieldName, factText, label }: FieldSketchProps) {
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
          {model.names.map((name) => (
            <Halo key={name.text} x={name.at[0]} y={name.at[1]} size={font} weight={500} italic>
              {name.text}
            </Halo>
          ))}
        </g>
        <g aria-hidden="true">
          <Halo x={nameAt[0]} y={nameAt[1]} size={labelFont} weight={700}>
            {fieldName}
          </Halo>
          {fact && factText && (
            <FactCallout
              fact={fact}
              text={factText}
              font={labelFont}
              unit={unit}
              width={width}
              height={height}
              avoidY={nameAt[1]}
              fieldTop={fieldTop}
              fieldBottom={fieldBottom}
            />
          )}
          <ScaleBar
            meters={model.scale.meters}
            length={model.scale.length}
            height={height}
            unit={unit}
            font={font}
          />
          <NorthArrow x={width - pad * 2.4} y={pad * 1.6} unit={unit} font={font} label={t('north')} />
        </g>
      </svg>
    </>
  );
}

/** Fakt z raportu: linia odniesienia do rowu w polu albo linia wymiarowa do najblizszego obiektu. */
function FactCallout({
  fact,
  text,
  font,
  unit,
  width,
  height,
  avoidY,
  fieldTop,
  fieldBottom,
}: {
  fact: NonNullable<FieldSketchModel['fact']>;
  text: string;
  font: number;
  unit: number;
  width: number;
  height: number;
  avoidY: number;
  /** gorna i dolna krawedz pola - etykieta rowu w polu stoi poza polem, zeby nie zaslaniala rowu */
  fieldTop: number;
  fieldBottom: number;
}) {
  const pad = 10 * unit;
  const boxWidth = textWidth(text, font) + pad * 1.6;
  const boxHeight = font * 1.8;
  // tylko dolny lewy rog (podzialka) i gorny prawy (polnoc) sa zajete
  const placeBox = (target: SketchPoint, preferAbove: boolean): SketchPoint => {
    const above = target[1] - boxHeight * 2.2;
    const below = target[1] + boxHeight * 2.2;
    const y = preferAbove && above > pad ? above : below < height - boxHeight - pad * 3 ? below : above;

    return [
      clamp(target[0] - boxWidth / 2, pad, width - boxWidth - pad * 4),
      clamp(y - boxHeight / 2, pad, height - boxHeight - pad * 3.5),
    ];
  };

  if (fact.kind === 'ditch_through') {
    const nameBelow = avoidY > fact.anchor[1];
    const outside = nameBelow ? fieldTop - boxHeight - pad * 1.5 : fieldBottom + pad * 1.5;
    const fits = outside > pad && outside + boxHeight < height - pad * 3.5;
    const near = placeBox(fact.anchor, nameBelow);
    const x = fits ? clamp(fact.anchor[0] - boxWidth / 2, pad, width - boxWidth - pad * 4) : near[0];
    const y = fits ? outside : near[1];
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
  const [x, y] = placeBox(middle, true);
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
