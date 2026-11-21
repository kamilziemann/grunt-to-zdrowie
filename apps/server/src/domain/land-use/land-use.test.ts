import { describe, expect, it } from 'vitest';

import {
  hasFarmland,
  landUseKind,
  parseLandUseCodes,
  soilClassNumber,
  soilClassesOf,
  summarizeLandUse,
} from './land-use';

describe('landUseKind', () => {
  it('rozpoznaje oznaczenia uzytkow, takze z klasa i pochodne', () => {
    const codes = ['RIVb', 'S-RIIIa', 'ŁV', 'PsVI', 'W/ŁV', 'Wsr-RIVa', 'Lzr-PsIV', 'Br-RV', 'LsV', 'Lz'];
    const more = ['dr', 'Bi', 'B', 'Tk', 'Ws', 'Wp', 'N', 'E-Ws'];

    expect(codes.map(landUseKind)).toEqual([
      'arable',
      'orchard',
      'meadow',
      'pasture',
      'ditches',
      'ponds',
      'farm_woodland',
      'farm_buildings',
      'forest',
      'woodland',
    ]);
    expect(more.map(landUseKind)).toEqual([
      'road',
      'built',
      'built',
      'railway',
      'water',
      'water',
      'wasteland',
      'other',
    ]);
  });
});

describe('klasy bonitacyjne', () => {
  it('bierze klasy gruntow rolnych (R, L, Ps, takze po myslniku), bez klas lasu', () => {
    expect(soilClassesOf(['RVI', 'RIVb', 'ŁV', 'W/ŁV', 'S-RIIIa', 'LsIV', 'dr', 'RVIz'])).toEqual([
      'IIIa',
      'IVb',
      'V',
      'VI',
      'VIz',
    ]);
  });

  it('klasa jako liczba 1-6', () => {
    expect(['I', 'IIIa', 'IIIb', 'IVb', 'V', 'VIz', 'X'].map(soilClassNumber)).toEqual([
      1,
      3,
      3,
      4,
      5,
      6,
      null,
    ]);
  });
});

describe('summarizeLandUse', () => {
  it('droga albo las to grunt nierolny - ocena dotyczy okolicy', () => {
    expect(summarizeLandUse(['dr'], 'winter_wheat')).toMatchObject({
      kinds: ['road'],
      agricultural: false,
      mismatch: 'non_agricultural',
      cropHint: null,
      soilClasses: [],
    });
    expect(summarizeLandUse(['LsV'], 'winter_wheat', 0.2655)).toMatchObject({
      mismatch: 'non_agricultural',
      registryAreaHa: 0.2655,
    });
  });

  it('grunt orny z laka: rolny, podpowiedz uzytkow zielonych, klasy jako dowod', () => {
    expect(summarizeLandUse(['RIVb', 'RV', 'RVI', 'ŁV', 'W/ŁV'], 'maize_grain')).toEqual({
      codes: ['RIVb', 'RV', 'RVI', 'ŁV', 'W/ŁV'],
      kinds: ['arable', 'meadow', 'ditches'],
      agricultural: true,
      soilClasses: ['IVb', 'V', 'VI'],
      cropHint: 'grassland',
      mismatch: null,
    });
  });

  it('same laki przy uprawie polowej - niezgodnosc; przy uzytkach zielonych - zgodnie', () => {
    expect(summarizeLandUse(['ŁIV', 'PsV'], 'winter_wheat')).toMatchObject({
      mismatch: 'grassland_only',
      cropHint: 'grassland',
    });
    expect(summarizeLandUse(['ŁIV', 'PsV'], 'grassland')).toMatchObject({ mismatch: null, cropHint: null });
  });

  it('bez klasouzytkow nie ma opisu', () => {
    expect(summarizeLandUse(undefined, 'winter_wheat')).toBeNull();
    expect(summarizeLandUse([], 'winter_wheat')).toBeNull();
  });
});

describe('parseLandUseCodes i hasFarmland', () => {
  it('dzieli liste z ewidencji i rozpoznaje grunt uprawny', () => {
    expect(parseLandUseCodes('RIVb, RV,,RIVb ')).toEqual(['RIVb', 'RV']);
    expect(parseLandUseCodes('')).toEqual([]);
    expect(hasFarmland(['dr', 'Bi'])).toBe(false);
    expect(hasFarmland(['W/ŁV', 'S-RIIIa'])).toBe(true);
  });
});
