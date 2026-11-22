// Uproszczony szkic dzialki z przykladu `ditch` (Chwalim 349/1) do karty "Przyklad wyniku": granica z geometrii
// ULDK (raport `field.geometry`) i rowy BDOT10k z `/api/hydro/tile?x=8912&y=5408` (poziom 14), oba w rzucie
// prostokatnym wokol srodka pola (1 px ok. 2,8 m), przyciete do ramki i uproszczone (Douglas-Peucker, 1,5 px).
// Wspolrzedne przepisane 2026-11-22 - to staly obrazek przykladu, nie mapa na zywo.

/** Granica dzialki w ukladzie viewBox 480 x 320. */
const FIELD = '121,164 185,196 267,272 274,265 359,196 170,48';

/** Rowy melioracyjne w ramce (dwa przecinaja pole - raport: "2 rowy przez pole, razem 428 m"). */
const DITCHES = [
  '266,122 252,123 241,131 241,157 228,176 180,196 151,199 71,201',
  '228,0 265,51 266,122',
  '305,179 305,146 282,124 278,122 266,122',
  '196,275 143,285',
] as const;

/** Punkt 1: srodek strefy `zone-5` (przy rowie, 0 m), z ktora silnik wiaze zalecenie "zastawka na rowie". */
const WEIR = { x: 240, y: 166 } as const;

/** Szkic dzialki z rowami i punktem pierwszego zalecenia; opis dla czytnikow ekranu w `label` (obrazek ukryty). */
export function ShowcaseSketch({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <svg
        viewBox="0 0 480 320"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        <defs>
          <pattern id="showcase-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" className="stroke-border" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="480" height="320" fill="url(#showcase-grid)" />
        <polygon
          points={FIELD}
          className="fill-data-sand stroke-foreground"
          fillOpacity="0.9"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {DITCHES.map((points) => (
          <polyline
            key={points}
            points={points}
            fill="none"
            className="stroke-data-blue"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <circle cx={WEIR.x} cy={WEIR.y} r="15" className="fill-foreground stroke-card" strokeWidth="3" />
        <text x={WEIR.x} y={WEIR.y + 6} textAnchor="middle" className="fill-accent text-base font-semibold">
          1
        </text>
      </svg>
    </>
  );
}
