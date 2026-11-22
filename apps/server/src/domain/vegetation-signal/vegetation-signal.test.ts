import type { CropId } from '@app/contracts';
import { describe, expect, it } from 'vitest';

import type { StageInput } from '../analysis-stages';
import { cropAtDate } from '../crop-calendar';
import { drierThreshold, vegetationSignal } from './vegetation-signal';

const observation = (date: string, ndmi: number) => ({ date, ndvi: 0.6, ndmi, validShare: 1, pixels: 100 });

/** Wejscie etapu z samym satelita: biezace NDMI i tlo 0,20 z trzech lat. */
function input(cropId: CropId, date: string, ndmi: number): StageInput {
  const year = Number(date.slice(0, 4));

  return {
    cropId,
    date,
    crop: cropAtDate(cropId, date),
    vegetation: {
      observations: [observation(date, ndmi)],
      baseline: [1, 2, 3].map((back) =>
        Object.assign(observation(`${year - back}${date.slice(4)}`, 0.2), { year: year - back }),
      ),
      cellSizeM: 10,
      rejected: [],
      window: { from: date, to: date },
    },
  } as unknown as StageInput;
}

describe('vegetationSignal - interpretacja zalezna od uprawy i fazy', () => {
  it('progi: gesty lan -0,05, szerokie rzedy -0,07, dojrzewanie zboz -0,15, wschody bez progu', () => {
    expect(drierThreshold('winter_wheat', 'mid')).toBe(-0.05);
    expect(drierThreshold('maize_grain', 'mid')).toBe(-0.07);
    expect(drierThreshold('winter_wheat', 'late')).toBe(-0.15);
    expect(drierThreshold('maize_grain', 'initial')).toBeNull();
  });

  it('ten sam spadek NDMI: pszenica w pelni wzrostu - stres, kukurydza w szerokich rzedach - jeszcze nie', () => {
    const wheat = vegetationSignal(input('winter_wheat', '2021-05-25', 0.14), true);
    const maize = vegetationSignal(input('maize_grain', '2021-07-20', 0.14), true);

    expect(wheat).toMatchObject({ interpretation: 'confirms_deficit', thresholdNdmi: -0.05, stage: 'mid' });
    expect(maize).toMatchObject({ interpretation: 'no_signal', thresholdNdmi: -0.07 });
  });

  it('dojrzewajace zboze: umiarkowany spadek to faza uprawy, gleboki - stres', () => {
    const date = '2021-07-10';

    expect(cropAtDate('winter_wheat', date).stage).toBe('late');
    expect(vegetationSignal(input('winter_wheat', date, 0.1), false)).toMatchObject({
      interpretation: 'expected_seasonal',
      reason: 'ripening',
    });
    expect(vegetationSignal(input('winter_wheat', date, 0), true)?.interpretation).toBe('confirms_deficit');
  });

  it('laka bez niedoboru w bilansie: spadek to raczej pokos; z niedoborem - potwierdza susze', () => {
    expect(vegetationSignal(input('grassland', '2021-06-20', 0.1), false)).toMatchObject({
      interpretation: 'expected_seasonal',
      reason: 'mowing',
    });
    expect(vegetationSignal(input('grassland', '2021-06-20', 0.1), true)?.interpretation).toBe(
      'confirms_deficit',
    );
  });

  it('wschody i okres poza wzrostem: piksel to gleba - bez porownania', () => {
    const sowing = input('maize_grain', '2021-05-01', 0.05);

    expect(sowing.crop.stage).toBe('initial');
    expect(vegetationSignal(sowing, true)).toMatchObject({
      interpretation: 'not_comparable',
      reason: 'sparse_canopy',
    });
    expect(vegetationSignal(input('winter_wheat', '2021-11-15', 0.05), false)?.interpretation).toBe(
      'not_comparable',
    );
  });
});
