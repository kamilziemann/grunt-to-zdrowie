import type { Zone } from '@app/contracts';
import { useId, type ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import type { FieldSketchModel } from '@/lib/field-sketch';

import { hasPattern, ZonePatternDefs, zoneFill, zoneStroke } from './zone-patterns';

/** Probka znaku z legendy - te same grubosci i wzory co na szkicu (czytelne bez koloru). */
function Sample({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 16" aria-hidden="true" className="h-4 w-8 shrink-0">
      {children}
    </svg>
  );
}

const SAMPLES = {
  field: (
    <Sample>
      <rect
        x="2"
        y="2"
        width="28"
        height="12"
        fill="var(--sketch-field-fill)"
        stroke="var(--sketch-field)"
        strokeWidth="2.6"
      />
    </Sample>
  ),
  ditch: (
    <Sample>
      <path d="M2 8H30" stroke="var(--sketch-ditch)" strokeWidth="1.6" strokeLinecap="round" />
    </Sample>
  ),
  watercourse: (
    <Sample>
      <path d="M2 8H30" stroke="var(--sketch-stream)" strokeWidth="3.4" strokeLinecap="round" />
    </Sample>
  ),
  canal: (
    <Sample>
      <path d="M2 8H30" stroke="var(--sketch-stream)" strokeWidth="2.4" strokeDasharray="7 4" />
    </Sample>
  ),
  water: (
    <Sample>
      <rect
        x="2"
        y="2"
        width="28"
        height="12"
        rx="4"
        fill="var(--sketch-water)"
        stroke="var(--sketch-stream)"
      />
    </Sample>
  ),
  wetland: (
    <Sample>
      <path d="M4 14L14 2M12 14L22 2M20 14L30 2" stroke="var(--sketch-wetland)" strokeWidth="1.4" />
      <rect
        x="2"
        y="2"
        width="28"
        height="12"
        fill="none"
        stroke="var(--sketch-wetland)"
        strokeDasharray="5 3"
      />
    </Sample>
  ),
  highlight: (
    <Sample>
      <path d="M2 8H30" stroke="var(--sketch-highlight)" strokeWidth="4.5" strokeLinecap="round" />
    </Sample>
  ),
};

/** Probka miejsca na polu: ten sam wzor (kropki, fale, kreski) i obrys co na szkicu. */
function ZoneSample({ kind, prefix }: { kind: Zone['kind']; prefix: string }) {
  return (
    <Sample>
      {hasPattern(kind) && (
        <defs>
          <ZonePatternDefs prefix={prefix} unit={1} />
        </defs>
      )}
      {kind === 'flow_path' ? (
        <path d="M2 8H30" stroke={zoneStroke(kind)} strokeWidth="3" strokeDasharray="5 3" />
      ) : (
        <rect
          x="2"
          y="2"
          width="28"
          height="12"
          fill={zoneFill(prefix, kind)}
          stroke={zoneStroke(kind)}
          strokeWidth="1.2"
          strokeDasharray={kind === 'segment' ? '5 3' : undefined}
        />
      )}
    </Sample>
  );
}

const NO_KINDS: readonly Zone['kind'][] = [];

/** Kolejnosc rodzajow miejsc w legendzie. */
const ZONE_LEGEND_ORDER = ['drying', 'collecting', 'depression', 'flow_path', 'segment'] as const;

/**
 * Legenda pod szkicem: granica pola, rodzaje miejsc na polu (wzory) i tylko te rodzaje wody, ktore sa na rysunku.
 */
export function SketchLegend({
  model,
  zoneKinds = NO_KINDS,
}: {
  model: FieldSketchModel;
  /** rodzaje narysowanych miejsc na polu */
  zoneKinds?: readonly Zone['kind'][];
}) {
  const t = useTranslations('report.fieldMap.sketch.legend');
  const prefix = useId();
  const names = model.names.map((name) => name.text);
  const items: { key: string; sample: ReactNode; text: string }[] = [
    { key: 'field', sample: SAMPLES.field, text: t('field') },
  ];

  if (model.highlight && model.fact) {
    items.push({
      key: 'highlight',
      sample: SAMPLES.highlight,
      text:
        model.fact.kind !== 'ditch_through'
          ? t('highlightNearest')
          : t(model.fact.alongEdge ? 'highlightAlongEdge' : 'highlightThrough', {
              count: model.fact.ditches,
            }),
    });
  }

  for (const kind of ZONE_LEGEND_ORDER) {
    if (!zoneKinds.includes(kind)) continue;

    items.push({
      key: `zone-${kind}`,
      sample: <ZoneSample kind={kind} prefix={`${prefix}-${kind}`} />,
      text: t(`zones.${kind}`),
    });
  }

  for (const group of ['ditch', 'watercourse', 'canal', 'water', 'wetland'] as const) {
    if (!model.groups.includes(group)) continue;

    items.push({
      key: group,
      sample: SAMPLES[group],
      text:
        group === 'watercourse' && names.length > 0
          ? t('watercourseNamed', { names: names.join(', ') })
          : t(group),
    });
  }

  return (
    <ul
      aria-label={t('title')}
      className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2"
      data-testid="field-sketch-legend"
    >
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2" data-legend={item.key}>
          {item.sample}
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
