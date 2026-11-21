// Walidacja silnika na znanych przypadkach suszy rolniczej z komunikatow IUNG (SMSR): liczy nasz raport dla pola
// ok. 5 ha w gminie/regionie z komunikatu i porownuje werdykt KBW (kategoria gleby z SoilGrids) oraz poziom oceny
// z tym, co oglosil IUNG. Wynik to tabela Markdown do docs/validation.md - rozbieznosci sa czescia wyniku.
// Uzycie (z apps/server, przy dzialajacym `bun run dev`): bun run validate:iung [-- --api http://localhost:3210/api]
// Analizy ida po kolei z przerwa - Copernicus odrzuca serie zapytan z jednego konta.
import type { WaterReport } from '@app/contracts';

interface Case {
  /** miejsce z komunikatu i punkt w srodku gminy/regionu (dlugosc, szerokosc) */
  place: string;
  point: [number, number];
  cropId: 'spring_barley' | 'maize_grain' | 'winter_wheat';
  date: string;
  /** co oglosil IUNG dla tej gminy/regionu i uprawy */
  iung: 'drought' | 'none';
  source: string;
}

// Przypadki z docs/research/2026-11-21-metodyka-uprawy-walidacja.md (sekcja 5) - z odnosnikami do komunikatow.
const CASES: Case[] = [
  {
    place: 'Sicienko (kujawsko-pomorskie)',
    point: [17.86, 53.2],
    cropId: 'spring_barley',
    date: '2023-05-20',
    iung: 'none',
    source: 'IUNG 2023, raport 1',
  },
  {
    place: 'Ludwin (lubelskie)',
    point: [22.94, 51.36],
    cropId: 'spring_barley',
    date: '2023-05-20',
    iung: 'none',
    source: 'IUNG 2023, raport 1',
  },
  {
    place: 'Sicienko (kujawsko-pomorskie)',
    point: [17.86, 53.2],
    cropId: 'spring_barley',
    date: '2023-06-20',
    iung: 'drought',
    source: 'IUNG 2023, raport 4 (144/144 gmin)',
  },
  {
    place: 'Obrowo (kujawsko-pomorskie)',
    point: [18.85, 53.0],
    cropId: 'spring_barley',
    date: '2023-06-20',
    iung: 'drought',
    source: 'IUNG 2023, raport 4 (144/144 gmin)',
  },
  {
    place: 'Zielona Góra (lubuskie)',
    point: [15.5, 51.94],
    cropId: 'maize_grain',
    date: '2022-07-31',
    iung: 'drought',
    source: 'IUNG 2022, raport 8 (78/82 gmin, 36,7% pow.)',
  },
  {
    place: 'Pojezierze Poznańskie (Pniewy)',
    point: [16.26, 52.51],
    cropId: 'winter_wheat',
    date: '2018-07-10',
    iung: 'drought',
    source: 'Doroszewski i Koza, Studia i Raporty IUNG 71',
  },
  {
    place: 'Wysoczyzna Żarnowiecka (Krokowa)',
    point: [18.16, 54.76],
    cropId: 'winter_wheat',
    date: '2018-07-10',
    iung: 'drought',
    source: 'Doroszewski i Koza, Studia i Raporty IUNG 71',
  },
  {
    place: 'zachodnia Wielkopolska (Nowy Tomyśl)',
    point: [16.13, 52.32],
    cropId: 'maize_grain',
    date: '2019-07-31',
    iung: 'drought',
    source: 'Doroszewski i Koza, Studia i Raporty IUNG 71',
  },
  {
    place: 'Wysoczyzna Łaska (Łask)',
    point: [19.13, 51.59],
    cropId: 'maize_grain',
    date: '2019-07-31',
    iung: 'drought',
    source: 'Doroszewski i Koza, Studia i Raporty IUNG 71',
  },
  {
    place: 'Równina Opolska (Dobrzeń Wielki)',
    point: [17.88, 50.77],
    cropId: 'maize_grain',
    date: '2019-07-31',
    iung: 'drought',
    source: 'Doroszewski i Koza, Studia i Raporty IUNG 71',
  },
];

const argv = process.argv.slice(2);
const apiIndex = argv.indexOf('--api');
const api = apiIndex >= 0 ? (argv[apiIndex + 1] ?? '') : 'http://localhost:3000/api';
const PAUSE_MS = 4000;

/** Prostokat ok. 270 x 220 m (ok. 6 ha) od punktu na polnocny wschod. */
function rectangle([lng, lat]: [number, number]) {
  const ring: [number, number][] = [
    [lng, lat],
    [lng + 0.004, lat],
    [lng + 0.004, lat + 0.002],
    [lng, lat + 0.002],
    [lng, lat],
  ];

  return { type: 'Polygon' as const, coordinates: [ring] };
}

const yesNo = (value: boolean | null | undefined): string =>
  value === null || value === undefined ? '–' : value ? 'tak' : 'nie';

function row(item: Case, report: WaterReport): string {
  const balance = report.assessment.climaticBalance;
  const scenarios = (balance?.categoryScenarios ?? [])
    .map((scenario) => yesNo(scenario.belowThreshold))
    .join('/');
  const kbwDrought = balance?.belowThreshold ?? null;
  const level = report.assessment.level;
  const warns = ['drought', 'risk', 'watch'].includes(level);
  const agreeKbw = kbwDrought === null ? '?' : kbwDrought === (item.iung === 'drought') ? '✓' : '✗';
  const agreeLevel = warns === (item.iung === 'drought') ? '✓' : '✗';

  return [
    `${item.place}, ${item.date}`,
    item.cropId,
    item.iung === 'drought' ? 'susza' : 'brak',
    `${balance?.balanceMm ?? '–'} / ${balance?.thresholdMm ?? '–'} (kat. ${balance?.soilCategory ?? '?'}, okres ${balance?.periodNo ?? '–'})`,
    scenarios,
    `${level} / ${report.assessment.confidence}`,
    agreeKbw,
    agreeLevel,
  ].join(' | ');
}

console.log(`Walidacja na ${CASES.length} przypadkach IUNG, API ${api}\n`);
console.log(
  '| Miejsce, data | Uprawa | IUNG | KBW / próg (kat., okres) | Pod progiem kat. I/II/III/IV | Poziom / pewność | Zgodność KBW | Zgodność poziomu |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');

for (const item of CASES) {
  const response = await fetch(`${api}/analysis`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      field: { geometry: rectangle(item.point), label: item.place },
      cropId: item.cropId,
      date: item.date,
    }),
  });

  if (!response.ok) {
    console.log(`| ${item.place}, ${item.date} | ${item.cropId} | błąd HTTP ${response.status} | | | | | |`);
    continue;
  }

  console.log(`| ${row(item, (await response.json()) as WaterReport)} |`);
  await Bun.sleep(PAUSE_MS);
}
