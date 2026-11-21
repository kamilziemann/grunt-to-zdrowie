// Dopiski do zalecen z otoczenia pola (BDOT10k) - gotowe zdania po polsku z liczbami, jak opisy stref. Ostroznie:
// BDOT10k nie zna zastawek ani przepustow, wiec o istniejacym urzadzeniu na rowie tylko pytamy. Podstawy prawne
// sprawdzone w tekscie jednolitym ustawy o ochronie przyrody (Dz.U. 2024 poz. 1478, api.sejm.gov.pl/eli/acts/DU/2024/1478):
// art. 15 ust. 1 pkt 7 (park narodowy, rezerwat), art. 16 ust. 3 i 17 ust. 1 pkt 6 (park krajobrazowy - zakazy
// wybiera uchwala sejmiku), art. 33 ust. 1 (Natura 2000). O ujeciach wody nic nie twierdzimy (niesprawdzone).
import type {
  ProtectedArea,
  ProtectedAreaKind,
  RecommendationNote,
  WaterStructureKind,
} from '@app/contracts';

import type { StageInput } from '../analysis-stages';
import type { DrainedLowland } from '../drained-lowland';

/** zrodlo blizej niz tyle (m) moze zasilac oczko na polu */
export const SPRING_NEAR_M = 500;

/** "347 m", "1,2 km" */
export function distanceText(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1).replace('.', ',').replace(',0', '')} km`;
}

const STRUCTURE_NAMES: Record<WaterStructureKind, string> = { weir: 'jaz', dam: 'zapora', lock: 'śluza' };

const named = (name: string | null): string => (name ? ` „${name}”` : '');

const listOf = (areas: readonly ProtectedArea[]): string => areas.map((area) => area.name).join(', ');

/** Zastrzezenie dla oczka i zastawki w obszarze chronionym - jedno zdanie na rodzaj obszaru. */
const PROTECTED_TEXT: Record<ProtectedAreaKind, (names: string) => string> = {
  national_park: (names) =>
    `Pole leży w parku narodowym (${names}). Ustawa o ochronie przyrody zakazuje tam zmian stosunków wodnych, które nie służą ochronie przyrody (art. 15 ust. 1 pkt 7) — zanim zaczniesz, uzgodnij to z dyrekcją parku.`,
  nature_reserve: (names) =>
    `Pole leży w rezerwacie przyrody (${names}). Ustawa o ochronie przyrody zakazuje tam zmian stosunków wodnych, które nie służą ochronie przyrody (art. 15 ust. 1 pkt 7) — zanim zaczniesz, zapytaj regionalnego dyrektora ochrony środowiska.`,
  natura2000: (names) =>
    `Pole leży w obszarze Natura 2000 (${names}). Zakazane są działania, które mogą znacząco pogorszyć stan chronionych tam siedlisk i gatunków (art. 33 ust. 1 ustawy o ochronie przyrody) — zapytaj regionalnego dyrektora ochrony środowiska, czy ta zmiana stosunków wodnych może na nie wpłynąć.`,
  landscape_park: (names) =>
    `Pole leży w parku krajobrazowym (${names}). Uchwała sejmiku dla parku może zakazywać zmian stosunków wodnych, które nie służą racjonalnej gospodarce rolnej (art. 17 ust. 1 pkt 6 ustawy o ochronie przyrody) — sprawdź ją albo zapytaj dyrekcję parku.`,
};

const PROTECTED_ORDER: readonly ProtectedAreaKind[] = [
  'national_park',
  'nature_reserve',
  'natura2000',
  'landscape_park',
];

export function protectedAreaNotes({ surroundings }: StageInput): RecommendationNote[] {
  const areas = surroundings?.protectedAreas ?? [];

  return PROTECTED_ORDER.flatMap((kind) => {
    const ofKind = areas.filter((area) => area.kind === kind);

    return ofKind.length > 0
      ? [{ id: 'protected_area' as const, text: PROTECTED_TEXT[kind](listOf(ofKind)) }]
      : [];
  });
}

/** Zastawka na rowie: zapytaj o istniejace urzadzenie, wskaz jaz w poblizu i styk rowu z rura, polder, ochrona. */
export function ditchWeirNotes(input: StageInput, lowland: DrainedLowland): RecommendationNote[] {
  const water = input.surroundings?.water;
  const structure = water?.nearestStructure ?? null;
  const junction = water?.pipedJunction ?? null;
  const elevation = lowland.evidence.find((item) => item.metric === 'elevation_min_m')?.value;
  const ditches = lowland.evidence.find((item) => item.metric === 'ditches_in_radius')?.value;

  return [
    {
      id: 'check_existing_structure',
      text: 'Sprawdź, czy na tym rowie jest już zastawka albo przepust z możliwością piętrzenia — mapy ich nie pokazują. Jeśli nie ma, rozważ zastawkę i uzgodnij ją ze spółką wodną albo zarządcą rowu.',
    },
    ...(lowland.detected
      ? [
          {
            id: 'drained_lowland' as const,
            text: `Pole leży na terenie odwadnianym mechanicznie (polder: najniższy punkt ${String(elevation).replace('.', ',')} m n.p.m., ${ditches} odcinków rowów w promieniu 500 m). Zamiast oczka zatrzymuj wodę w rowach: uzgodnij ze spółką wodną i zarządcą przepompowni regulowany odpływ — wyższy poziom wody w rowach wiosną i latem, obniżany przed zbiorem i przy nadmiarze.`,
          },
        ]
      : []),
    ...(junction
      ? [
          {
            id: 'piped_junction' as const,
            text: `${distanceText(junction.distanceM)} od pola otwarty rów wchodzi w rurę (zwykle przepust pod drogą) — to naturalne miejsce na piętrzenie wody w rowie.`,
          },
        ]
      : []),
    ...(structure
      ? [
          {
            id: 'structure_nearby' as const,
            text: `${distanceText(structure.distanceM)} od pola jest ${STRUCTURE_NAMES[structure.kind]}${named(structure.name)} — zapytaj zarządcę (spółka wodna, Wody Polskie), czy piętrzy wodę i w jakich miesiącach.`,
          },
        ]
      : []),
    ...protectedAreaNotes(input),
  ];
}

/** Oczko: zrodlo w poblizu jako argument za zasilaniem, zastrzezenie w obszarze chronionym. */
export function pondNotes(input: StageInput): RecommendationNote[] {
  const spring = input.surroundings?.water.nearestSpring ?? null;

  return [
    ...(spring && spring.distanceM <= SPRING_NEAR_M
      ? [
          {
            id: 'spring_nearby' as const,
            text: `Źródło${named(spring.name)} ${distanceText(spring.distanceM)} od pola może zasilać oczko wodą także w suchym okresie — sprawdź, czy płynie latem.`,
          },
        ]
      : []),
    ...protectedAreaNotes(input),
  ];
}
