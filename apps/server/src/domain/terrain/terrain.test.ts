import { describe, expect, it } from 'vitest';

import type { TerrainGrid } from '../analysis-ports';
import {
  fillDepressions,
  findDepressions,
  flowAccumulation,
  slopePercent,
  summarizeTerrain,
  wetnessIndex,
} from './terrain';

/** Siatka n x n z funkcji wysokosci (kolumna, wiersz w metrach od NW). */
function surface(size: number, cellSizeM: number, height: (x: number, y: number) => number): TerrainGrid {
  return {
    crs: 'test:local',
    originX: 0,
    originY: 0,
    cellSizeM,
    cols: size,
    rows: size,
    elevationM: Array.from({ length: size * size }, (_unused, index) =>
      height((index % size) * cellSizeM, Math.floor(index / size) * cellSizeM),
    ),
  };
}

const everywhere = (grid: TerrainGrid) => grid.elevationM.map(() => true);

describe('teren na sztucznych powierzchniach', () => {
  it('rowna pochylnia 4% na poludnie: spadek 4% w kazdej komorce, bez zaglebien, nic powyzej 5%', () => {
    const plane = surface(20, 10, (_x, y) => 100 - 0.04 * y);
    const summary = summarizeTerrain(plane, everywhere(plane));

    expect(slopePercent(plane).every((value) => Math.abs(value - 4) < 1e-9)).toBe(true);
    expect(summary).toMatchObject({
      slopeMeanPct: 4,
      slopeShareAbove5Pct: 0,
      depressions: 0,
      depressionVolumeM3: 0,
    });
    expect(summary.elevationMaxM - summary.elevationMinM).toBeCloseTo(0.04 * 190, 6);
  });

  it('stok 8% w polowie siatki: udzial stokow > 5% to ok. polowa', () => {
    const terrace = surface(20, 10, (_x, y) => (y < 100 ? 100 - 0.08 * y : 92));
    const summary = summarizeTerrain(terrace, everywhere(terrace));

    expect(summary.slopeShareAbove5Pct).toBeGreaterThan(0.4);
    expect(summary.slopeShareAbove5Pct).toBeLessThan(0.6);
  });

  it('niecka 1 m glebokosci w plaskim terenie: jedno zaglebienie, pojemnosc = suma glebokosci x pole komorki', () => {
    // stozek o promieniu 30 m i glebokosci 1 m w srodku siatki 21 x 21 komorek po 5 m
    const bowl = surface(21, 5, (x, y) => 100 - Math.max(0, 1 - Math.hypot(x - 50, y - 50) / 30));
    const [depression, ...others] = findDepressions(bowl);
    const expected = bowl.elevationM.reduce((sum, value) => sum + (100 - value), 0) * 25;

    expect(others).toHaveLength(0);
    expect(depression?.maxDepthM).toBeCloseTo(1, 6);
    expect(depression?.volumeM3).toBeCloseTo(expected, 3);
    // stozek: V = pi r^2 h / 3 = ok. 942 m3 (siatka 5 m przybliza go z dokladnoscia kilku procent)
    expect(depression?.volumeM3).toBeGreaterThan(850);
    expect(depression?.volumeM3).toBeLessThan(1000);
  });

  it('plytkie wglebienie (2 cm) to szum, nie zaglebienie; wypelnienie nie obniza terenu', () => {
    const ripple = surface(11, 5, (x, y) => 100 - (x === 25 && y === 25 ? 0.02 : 0));

    expect(findDepressions(ripple)).toHaveLength(0);
    expect(fillDepressions(ripple).every((value, index) => value >= (ripple.elevationM[index] ?? 0))).toBe(
      true,
    );
  });

  it('dolinka: splyw zbiera sie w osi, a wskaznik wilgotnosci jest tam wyzszy niz na zboczach', () => {
    // zbocza 6% schodzace do osi x = 50 m, os opada 1% na poludnie
    const valley = surface(21, 5, (x, y) => 100 + 0.06 * Math.abs(x - 50) - 0.01 * y);
    const accumulation = flowAccumulation(valley);
    const wetness = wetnessIndex(valley);
    const axisBottom = 20 * 21 + 10;
    const slopeBottom = 20 * 21 + 2;

    expect(accumulation[axisBottom]).toBeGreaterThan(20);
    expect(accumulation[slopeBottom]).toBeLessThan(5);
    expect(wetness[axisBottom]).toBeGreaterThan((wetness[slopeBottom] ?? 0) + 2);
  });

  it('statystyki tylko z komorek pola; zaglebienie poza polem sie nie liczy', () => {
    const bowl = surface(21, 5, (x, y) => 100 - Math.max(0, 1 - Math.hypot(x - 50, y - 50) / 20));
    const westStrip = bowl.elevationM.map((_value, index) => index % 21 < 3);
    const centre = bowl.elevationM.map(
      (_value, index) => Math.abs((index % 21) - 10) <= 2 && Math.abs(Math.floor(index / 21) - 10) <= 2,
    );

    expect(summarizeTerrain(bowl, westStrip).depressions).toBe(0);
    expect(summarizeTerrain(bowl, centre)).toMatchObject({
      depressions: 1,
      largestDepression: { maxDepthM: 1 },
    });
  });
});
