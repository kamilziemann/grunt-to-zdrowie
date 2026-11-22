// Sygnal satelitarny (NDMI/NDVI z Sentinel-2) czytany wzgledem uprawy i jej fazy, nie jednym progiem dla wszystkich:
// - faza poczatkowa (siew, wschody): gleba przewaza nad roslinami - piksel mowi o glebie, nie o roslinach;
// - zboza i rzepak w fazie dojrzewania (late): naturalnie zasychaja, spadek NDMI to fizjologia, nie susza;
// - laka i pastwisko: spadek bywa pokosem albo wypasem - bez niedoboru w bilansie nie nazywamy go stresem;
// - uprawy w szerokich rzedach (kukurydza, burak, ziemniak, warzywa) i wieloletnie z murawa miedzy rzedami
//   (sad, krzewy, chmiel) - wiekszy udzial gleby i trawy w pikselu, wiec prog anomalii jest lagodniejszy.
// Porownanie jest z ta sama pora roku na tym samym polu; poprzednie uprawy (plodozmian) nie sa znane - mowi o tym
// ograniczenie `vegetation_rotation_unknown`.
import type { CropId, VegetationSignal } from '@app/contracts';

import type { StageInput } from '../analysis-stages';

/** archiwum Sentinel-2 L2A w Copernicus Data Space jest pelne od 2017 r. - wczesniejsze daty nie maja zdjec */
export const FIRST_SENTINEL_YEAR = 2017;

type CanopyKind = 'dense' | 'row' | 'perennial' | 'grassland';

const CANOPY: Readonly<Record<CropId, CanopyKind>> = {
  winter_wheat: 'dense',
  spring_barley: 'dense',
  winter_rapeseed: 'dense',
  pulses: 'dense',
  maize_grain: 'row',
  maize_silage: 'row',
  potato: 'row',
  sugar_beet: 'row',
  field_vegetables: 'row',
  tobacco: 'row',
  strawberry: 'perennial',
  berry_shrubs: 'perennial',
  fruit_trees: 'perennial',
  hops: 'perennial',
  grassland: 'grassland',
};

/** Prog spadku NDMI wzgledem lat poprzednich, od ktorego rosliny "maja mniej wody niz zwykle". */
const DRIER_NDMI: Readonly<Record<CanopyKind, number>> = {
  dense: -0.05,
  row: -0.07,
  perennial: -0.07,
  grassland: -0.06,
};

/** Dojrzewanie zboz i rzepaku: spadek NDMI ponizej tego progu to juz wiecej niz naturalne zasychanie. */
const RIPENING_DRIER_NDMI = -0.15;

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

function mean(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);

  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
}

/** Prog spadku NDMI dla uprawy w danej fazie (null = w tej fazie satelita nie mowi o wodzie w roslinach). */
export function drierThreshold(cropId: CropId, stage: VegetationSignal['stage']): number | null {
  if (stage === 'initial' || stage === 'dormant' || stage === 'harvested' || stage === undefined) return null;

  const canopy = CANOPY[cropId];

  if (stage === 'late' && canopy === 'dense') return RIPENING_DRIER_NDMI;

  return DRIER_NDMI[canopy];
}

/** Sygnal satelitarny wzgledem tej samej pory roku w latach poprzednich, czytany wedlug uprawy i fazy. */
export function vegetationSignal(input: StageInput, deficit: boolean): VegetationSignal | null {
  const [latest] = input.vegetation?.observations ?? [];

  if (!input.vegetation || !latest) return null;

  const { baseline } = input.vegetation;
  const { cropId, stage } = input.crop;
  const ndviBase = mean(baseline.map((item) => item.ndvi));
  const ndmiBase = mean(baseline.map((item) => item.ndmi));
  const ndviAnomaly = latest.ndvi === null || ndviBase === null ? null : round(latest.ndvi - ndviBase);
  const ndmiAnomaly = latest.ndmi === null || ndmiBase === null ? null : round(latest.ndmi - ndmiBase);
  const threshold = input.crop.kc === null ? null : drierThreshold(cropId, stage);
  const canopy = CANOPY[cropId];
  const base = {
    observedOn: latest.date,
    ndvi: latest.ndvi,
    ndmi: latest.ndmi,
    validShare: latest.validShare,
    pixels: latest.pixels,
    baselineYears: baseline.length,
    ndviAnomaly,
    ndmiAnomaly,
    stage,
    ...(threshold === null ? {} : { thresholdNdmi: threshold }),
  };

  // poza okresem wzrostu albo przy wschodach: piksel to glownie gleba - z woda w roslinach nie porownujemy
  if (threshold === null || baseline.length === 0 || ndmiAnomaly === null) {
    return {
      ...base,
      interpretation: 'not_comparable',
      ...(stage === 'initial' ? { reason: 'sparse_canopy' as const } : {}),
    };
  }

  const drier = ndmiAnomaly < threshold;
  // spadek przy dojrzewaniu (zboza, rzepak) albo przy lace bez niedoboru w bilansie: zwykla faza, nie stres
  const seasonalDrop = !deficit && ndmiAnomaly < DRIER_NDMI[canopy] && !drier;

  if (canopy === 'grassland' && drier && !deficit) {
    return { ...base, interpretation: 'expected_seasonal', reason: 'mowing' };
  }

  if (stage === 'late' && canopy === 'dense' && seasonalDrop) {
    return { ...base, interpretation: 'expected_seasonal', reason: 'ripening' };
  }

  return {
    ...base,
    interpretation: drier && deficit ? 'confirms_deficit' : drier ? 'possible_other_stress' : 'no_signal',
  };
}
