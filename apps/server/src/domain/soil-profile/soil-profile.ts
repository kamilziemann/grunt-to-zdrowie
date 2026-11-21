// Profil glebowy pola z warstw uziarnienia (np. SoilGrids 0-5 ... 100-200 cm): zapas wody dla bilansu strefy
// korzeniowej i kategoria IUNG dla progow suszy. Glebokosci, na ktorych liczymy:
// - woda dostepna w mm/m - srednia z 0-100 cm (bilans mnozy ja przez glebokosc korzeni uprawy),
// - uziarnienie i kategoria IUNG - srednia wazona z 0-150 cm, bo tak gleboki profil ocenia IUNG,
// - materia organiczna - warstwa orna 0-30 cm (na nia dzialaja zalecenia agrotechniczne).
// Kategoria ma zakres: z uziarnienia (grupa PTG) i z wody w profilu 0-150 cm (granice WOD IUNG). Gdy oba wskazania
// sie roznia, raport mowi, ze kategoria jest niepewna, a do progu bierzemy lzejszy koniec zakresu: SoilGrids
// zawyza udzial pylu i ilu w glebach lekkich Polski, a walidacja na wykazach gmin IUNG (docs/validation.md) daje
// z lzejsza kategoria zgodnosc KBW 7/8 przy suszy zamiast 3/8, bez falszywych alarmow w 13 przypadkach bez suszy.
import type { SoilProfile } from '../analysis-ports';
import { iungCategoryFromTexture, iungCategoryFromWater } from '../soil-category';
import { organicMatterFromCarbon, saxtonRawls } from '../soil-water';

export interface SoilLayer {
  topCm: number;
  bottomCm: number;
  sandPct: number;
  siltPct: number;
  clayPct: number;
  /** wegiel organiczny, g/kg */
  organicCarbonGPerKg: number;
}

const TOPSOIL_CM = 30;
const ROOT_PROFILE_CM = 100;
const IUNG_PROFILE_CM = 150;

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

const overlapCm = (layer: SoilLayer, fromCm: number, toCm: number): number =>
  Math.max(0, Math.min(layer.bottomCm, toCm) - Math.max(layer.topCm, fromCm));

/** Srednia wazona grubosci warstw w przedziale glebokosci; null, gdy zadna warstwa go nie dotyka. */
function weighted(
  layers: readonly SoilLayer[],
  fromCm: number,
  toCm: number,
  value: (layer: SoilLayer) => number,
): number | null {
  let sum = 0;
  let thickness = 0;

  for (const layer of layers) {
    const overlap = overlapCm(layer, fromCm, toCm);

    sum += value(layer) * overlap;
    thickness += overlap;
  }

  return thickness > 0 ? sum / thickness : null;
}

const waterOf = (layer: SoilLayer) =>
  saxtonRawls({
    sandPct: layer.sandPct,
    clayPct: layer.clayPct,
    organicMatterPct: organicMatterFromCarbon(layer.organicCarbonGPerKg),
  });

/** Profil z warstw; null, gdy nie ma zadnej warstwy w 0-100 cm. */
export function soilProfileFromLayers(
  layers: readonly SoilLayer[],
  { modelled }: { modelled: boolean } = { modelled: true },
): SoilProfile | null {
  const awcPerM = weighted(layers, 0, ROOT_PROFILE_CM, (layer) => waterOf(layer).availableWater * 1000);
  const fieldCapacity = weighted(layers, 0, ROOT_PROFILE_CM, (layer) => waterOf(layer).fieldCapacity);
  const wiltingPoint = weighted(layers, 0, ROOT_PROFILE_CM, (layer) => waterOf(layer).wiltingPoint);
  const sandPct = weighted(layers, 0, IUNG_PROFILE_CM, (layer) => layer.sandPct);
  const siltPct = weighted(layers, 0, IUNG_PROFILE_CM, (layer) => layer.siltPct);
  const clayPct = weighted(layers, 0, IUNG_PROFILE_CM, (layer) => layer.clayPct);
  const profileAwcPerM = weighted(
    layers,
    0,
    IUNG_PROFILE_CM,
    (layer) => waterOf(layer).availableWater * 1000,
  );
  const carbon = weighted(layers, 0, TOPSOIL_CM, (layer) => layer.organicCarbonGPerKg);

  if (
    awcPerM === null ||
    fieldCapacity === null ||
    wiltingPoint === null ||
    sandPct === null ||
    siltPct === null ||
    clayPct === null ||
    profileAwcPerM === null
  ) {
    return null;
  }

  const { category: byTexture, textureClass } = iungCategoryFromTexture({ sandPct, siltPct, clayPct });
  const profileMm = (profileAwcPerM * IUNG_PROFILE_CM) / 100;
  const byWater = iungCategoryFromWater(profileMm);
  const category = byTexture <= byWater ? byTexture : byWater;
  const heavier = byTexture <= byWater ? byWater : byTexture;

  return {
    sandPct: round(sandPct),
    siltPct: round(siltPct),
    clayPct: round(clayPct),
    organicMatterPct: round(organicMatterFromCarbon(carbon ?? 0), 2),
    fieldCapacity: round(fieldCapacity, 3),
    wiltingPoint: round(wiltingPoint, 3),
    availableWaterMmPerM: round(awcPerM),
    availableWaterProfileMm: round(profileMm),
    category,
    categoryRange: [category, heavier],
    basis: 'texture',
    ...(textureClass ? { textureClass } : {}),
    modelled,
  };
}
