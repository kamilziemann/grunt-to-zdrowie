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
  /** wynik IUNG dla kategorii gleby I/II/III/IV z wykazu gminy ("+" susza, "-" brak), gdy jest (od 2020 r.) */
  iungCategories?: string;
  source: string;
}

// Przypadki z notatki o metodyce i walidacji (research, sekcja 5) - z odnosnikami do komunikatow.
const CASES: Case[] = [
  {
    place: 'Sicienko (kujawsko-pomorskie)',
    point: [17.86, 53.2],
    cropId: 'spring_barley',
    date: '2023-05-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG 2023, raport 1',
  },
  {
    place: 'Ludwin (lubelskie)',
    point: [22.95, 51.354],
    cropId: 'spring_barley',
    date: '2023-05-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG 2023, raport 1',
  },
  {
    place: 'Sicienko (kujawsko-pomorskie)',
    point: [17.86, 53.2],
    cropId: 'spring_barley',
    date: '2023-06-20',
    iung: 'drought',
    iungCategories: '+/+/+/+',
    source: 'IUNG 2023, raport 4 (144/144 gmin)',
  },
  {
    place: 'Obrowo (kujawsko-pomorskie)',
    point: [18.85, 53.0],
    cropId: 'spring_barley',
    date: '2023-06-20',
    iung: 'drought',
    iungCategories: '+/+/+/+',
    source: 'IUNG 2023, raport 4 (144/144 gmin)',
  },
  {
    place: 'Zielona Góra (lubuskie)',
    point: [15.5, 51.94],
    cropId: 'maize_grain',
    date: '2022-07-31',
    iung: 'drought',
    iungCategories: '+/+/+/-',
    source: 'IUNG 2022, raport 8 (78/82 gmin, 36,7% pow.)',
  },
  {
    place: 'Pojezierze Poznańskie (Pniewy)',
    point: [16.24, 52.498],
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
    point: [16.13, 52.296],
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
    point: [17.86, 50.752],
    cropId: 'maize_grain',
    date: '2019-07-31',
    iung: 'drought',
    source: 'Doroszewski i Koza, Studia i Raporty IUNG 71',
  },
  // Przypadki "brak suszy" z wykazow gmin IUNG (https://susza.iung.pulawy.pl/wykazy/<rok>,<TERYT>/): kryterium
  // nieprzekroczone na wszystkich czterech kategoriach gleby, 0% powierzchni zagrozonej
  {
    place: 'Zielona Góra (lubuskie)',
    point: [15.5, 51.94],
    cropId: 'winter_wheat',
    date: '2021-06-30',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2021,0862011',
  },
  {
    place: 'Zielona Góra (lubuskie)',
    point: [15.5, 51.94],
    cropId: 'spring_barley',
    date: '2023-05-31',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2023,0862011',
  },
  {
    place: 'Obrowo (kujawsko-pomorskie)',
    point: [18.85, 53.0],
    cropId: 'winter_wheat',
    date: '2021-06-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2021,0415072',
  },
  {
    place: 'Sicienko (kujawsko-pomorskie)',
    point: [17.86, 53.2],
    cropId: 'maize_grain',
    date: '2020-08-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2020,0403072',
  },
  {
    place: 'Sicienko (kujawsko-pomorskie)',
    point: [17.86, 53.2],
    cropId: 'spring_barley',
    date: '2025-06-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2025,0403072',
  },
  {
    place: 'Nowy Tomyśl (wielkopolskie)',
    point: [16.13, 52.296],
    cropId: 'spring_barley',
    date: '2021-06-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2021,3015043',
  },
  {
    place: 'Pniewy (wielkopolskie)',
    point: [16.24, 52.498],
    cropId: 'winter_wheat',
    date: '2021-06-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2021,3024063',
  },
  {
    place: 'Krokowa (pomorskie)',
    point: [18.16, 54.76],
    cropId: 'winter_wheat',
    date: '2025-06-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2025,2211062',
  },
  {
    place: 'Łask (łódzkie)',
    point: [19.13, 51.59],
    cropId: 'maize_grain',
    date: '2024-08-20',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2024,1003023',
  },
  {
    place: 'Dobrzeń Wielki (opolskie)',
    point: [17.86, 50.752],
    cropId: 'spring_barley',
    date: '2023-05-31',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2023,1609032',
  },
  {
    place: 'Ludwin (lubelskie)',
    point: [22.95, 51.354],
    cropId: 'winter_wheat',
    date: '2023-05-31',
    iung: 'none',
    iungCategories: '-/-/-/-',
    source: 'IUNG, wykaz gminy 2023,0610022',
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

interface Outcome {
  agreeKbw: boolean | null;
  agreeLevel: boolean;
  /** ile kategorii I-IV zgadza sie z wykazem gminy IUNG (null = brak wykazu) */
  categoriesAgree: number | null;
}

function outcome(item: Case, report: WaterReport): Outcome {
  const balance = report.assessment.climaticBalance;
  const kbwDrought = balance?.belowThreshold ?? null;
  // alarm = susza albo ryzyko; "obserwuj" (watch) to nie ogloszenie suszy - liczymy je osobno
  const warns = ['drought', 'risk'].includes(report.assessment.level);
  const iung = item.iungCategories?.split('/');
  const ours = balance?.categoryScenarios ?? [];

  return {
    agreeKbw: kbwDrought === null ? null : kbwDrought === (item.iung === 'drought'),
    agreeLevel: warns === (item.iung === 'drought'),
    categoriesAgree: iung
      ? ours.filter((scenario, index) => scenario.belowThreshold === (iung[index] === '+')).length
      : null,
  };
}

const mark = (value: boolean | null): string => (value === null ? '?' : value ? '✓' : '✗');

function row(item: Case, report: WaterReport, result: Outcome): string {
  const balance = report.assessment.climaticBalance;
  const scenarios = (balance?.categoryScenarios ?? [])
    .map((scenario) => yesNo(scenario.belowThreshold))
    .join('/');
  const range = report.assessment.soilCategoryRange;

  return [
    `${item.place}, ${item.date}`,
    item.cropId,
    item.iung === 'drought' ? 'susza' : 'brak',
    item.iungCategories ?? '–',
    `${balance?.balanceMm ?? '–'} / ${balance?.thresholdMm ?? '–'} (kat. ${balance?.soilCategory ?? '?'}${range ? ` z ${range.join('–')}` : ''}, okres ${balance?.periodNo ?? '–'})`,
    scenarios,
    `${report.assessment.level} / ${report.assessment.confidence}`,
    mark(result.agreeKbw),
    mark(result.agreeLevel),
  ].join(' | ');
}

console.log(`Walidacja na ${CASES.length} przypadkach IUNG, API ${api}\n`);
console.log(
  '| Miejsce, data | Uprawa | IUNG | IUNG kat. I/II/III/IV | KBW / próg (kat., okres) | Pod progiem kat. I/II/III/IV | Poziom / pewność | Zgodność KBW | Zgodność poziomu |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

const results: { item: Case; result: Outcome; report: WaterReport }[] = [];

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
    console.log(
      `| ${item.place}, ${item.date} | ${item.cropId} | błąd HTTP ${response.status} | | | | | | |`,
    );
    continue;
  }

  const report = (await response.json()) as WaterReport;
  const result = outcome(item, report);

  results.push({ item, result, report });
  console.log(`| ${row(item, report, result)} |`);
  await Bun.sleep(PAUSE_MS);
}

const count = (filter: (entry: (typeof results)[number]) => boolean): number => results.filter(filter).length;
const drought = results.filter(({ item }) => item.iung === 'drought').length;
const listed = results.filter(({ result }) => result.categoriesAgree !== null);

console.log(`
Zgodność poziomu: ${count(({ result }) => result.agreeLevel)} z ${results.length} (susza: ${count(({ item, result }) => item.iung === 'drought' && result.agreeLevel)}/${drought}, brak: ${count(({ item, result }) => item.iung === 'none' && result.agreeLevel)}/${results.length - drought})
Zgodność KBW: ${count(({ result }) => result.agreeKbw === true)} z ${results.length} (susza: ${count(({ item, result }) => item.iung === 'drought' && result.agreeKbw === true)}/${drought}, brak: ${count(({ item, result }) => item.iung === 'none' && result.agreeKbw === true)}/${results.length - drought})
„Obserwuj” (watch) bez suszy wg IUNG: ${count(({ item, report }) => item.iung === 'none' && report.assessment.level === 'watch')} z ${results.length - drought}
Kategorie zgodne z wykazem gminy: ${listed.reduce((sum, { result }) => sum + (result.categoriesAgree ?? 0), 0)} z ${listed.length * 4}`);

const jsonIndex = argv.indexOf('--json');

if (jsonIndex >= 0) {
  await Bun.write(
    argv[jsonIndex + 1] ?? 'validation.json',
    JSON.stringify(
      results.map(({ item, result, report }) => ({ item, result, assessment: report.assessment })),
      null,
      1,
    ),
  );
}
