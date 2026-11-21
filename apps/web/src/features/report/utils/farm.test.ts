import { describe, expect, it } from 'vitest';

import { DROUGHT_REPORT } from '../fixtures/drought-report';
import { SAMPLE_REPORT } from '../fixtures/sample-report';
import { canStart, farmOrder } from './farm';

const withLevel = (level: 'ok' | 'risk' | 'drought', depletionShare = 0.5) => ({
  ...DROUGHT_REPORT,
  assessment: {
    ...DROUGHT_REPORT.assessment,
    level,
    rootZone: DROUGHT_REPORT.assessment.rootZone && { ...DROUGHT_REPORT.assessment.rootZone, depletionShare },
  },
});

describe('gospodarstwo', () => {
  it('kolejnosc: susza, potem ryzyko (mniejszy zapas wody wyzej), niepoliczone na koncu', () => {
    const rows = [
      { id: 'a', report: withLevel('ok') },
      { id: 'b', report: null },
      { id: 'c', report: withLevel('risk', 0.4) },
      { id: 'd', report: withLevel('drought') },
      { id: 'e', report: withLevel('risk', 0.8) },
    ];

    expect(farmOrder(rows).map((row) => row.id)).toEqual(['d', 'e', 'c', 'a', 'b']);
    expect(farmOrder([{ id: 'x', report: SAMPLE_REPORT }])).toHaveLength(1);
  });

  it('najwyzej dwie analizy naraz, w kolejnosci listy', () => {
    expect([0, 1, 2, 3].map((index) => canStart([false, false, false, false], index))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    // pierwszy render: stan zakonczonych jeszcze pusty
    expect([0, 1, 2].map((index) => canStart([], index))).toEqual([true, true, false]);
    // pierwsza gotowa - rusza trzecia
    expect([0, 1, 2, 3].map((index) => canStart([true, false, false, false], index))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});
