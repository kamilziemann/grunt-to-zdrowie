import type { Zone } from '@app/contracts';

/** Rodzaje miejsc z wlasnym wypelnieniem; "pozostala czesc pola" to tlo, odcinki profilu maja sam obrys. */
export type PatternKind = Extract<Zone['kind'], 'drying' | 'collecting' | 'depression'>;

export const PATTERN_KINDS: readonly PatternKind[] = ['drying', 'collecting', 'depression'];

export function hasPattern(kind: Zone['kind']): kind is PatternKind {
  return (PATTERN_KINDS as readonly string[]).includes(kind);
}

/** Kolor znaku: suchsze - ciepla barwa ostrzezenia, woda - barwa ciekow. Wzor niesie tresc i bez koloru. */
export const PATTERN_COLOR: Record<PatternKind, string> = {
  drying: 'var(--warning)',
  collecting: 'var(--sketch-stream)',
  depression: 'var(--sketch-stream)',
};

/**
 * Wzory miejsc na polu, rozroznialne w czerni i bieli: kropki = przesycha, fale = zbiera sie woda, poziome kreski
 * (lustro wody) = zaglebienie bez odplywu. `unit` = jednostki rysunku na piksel ekranu (wzor ma stala wielkosc).
 */
export function ZonePatternDefs({ prefix, unit }: { prefix: string; unit: number }) {
  const u = (value: number) => value * unit;

  return (
    <>
      <pattern id={`${prefix}-drying`} width={u(7)} height={u(7)} patternUnits="userSpaceOnUse">
        <circle cx={u(2)} cy={u(2)} r={u(1.4)} fill={PATTERN_COLOR.drying} />
        <circle cx={u(5.5)} cy={u(5.5)} r={u(1.4)} fill={PATTERN_COLOR.drying} />
      </pattern>
      <pattern id={`${prefix}-collecting`} width={u(12)} height={u(7)} patternUnits="userSpaceOnUse">
        <path
          d={`M0 ${String(u(4))}Q${String(u(3))} ${String(u(1))} ${String(u(6))} ${String(u(4))}T${String(u(12))} ${String(u(4))}`}
          fill="none"
          stroke={PATTERN_COLOR.collecting}
          strokeWidth={u(1.3)}
        />
      </pattern>
      <pattern id={`${prefix}-depression`} width={u(8)} height={u(5)} patternUnits="userSpaceOnUse">
        <line
          x1="0"
          y1={u(2.5)}
          x2={u(8)}
          y2={u(2.5)}
          stroke={PATTERN_COLOR.depression}
          strokeWidth={u(1.4)}
        />
      </pattern>
    </>
  );
}

/** Wypelnienie miejsca danego rodzaju albo `none` (tlo, odcinek profilu). */
export function zoneFill(prefix: string, kind: Zone['kind']): string {
  return hasPattern(kind) ? `url(#${prefix}-${kind})` : 'none';
}

/** Kolor obrysu miejsca. */
export function zoneStroke(kind: Zone['kind']): string {
  return hasPattern(kind) ? PATTERN_COLOR[kind] : 'var(--foreground)';
}
