import { describe, expect, it } from 'vitest';

import {
  BDOT_LAYERS,
  CONTEXT_KIND,
  HYDRO_KIND,
  HYDRO_LAYERS,
  type BdotLayer,
  type HydroLayer,
} from '../layers';
import { simplifyGeometry, toFeatureRecord } from './feature';

function layer(id: HydroLayer['id']): HydroLayer {
  const found = HYDRO_LAYERS.find((candidate) => candidate.id === id);

  if (!found) throw new Error(`brak warstwy ${id}`);

  return found;
}

function contextLayer(id: string): BdotLayer {
  const found = BDOT_LAYERS.find((candidate) => candidate.id === id);

  if (!found) throw new Error(`brak warstwy ${id}`);

  return found;
}

const LINE = {
  type: 'LineString',
  coordinates: [
    [637_000, 487_000],
    [637_050, 487_000.4],
    [637_100, 487_000],
  ],
};

describe('toFeatureRecord', () => {
  it('row na powierzchni: rodzaj, brak nazwy, uproszczona linia w EWKB', () => {
    const record = toFeatureRecord(layer('ditches'), { POLOZENIE: 'na powierzchni', GEOM: LINE }, 2);

    expect(record).toMatchObject({ k: HYDRO_KIND.ditch, n: null });
    // naglowek linii z SRID + 2 punkty (srodkowy odpadl)
    expect(record?.g.startsWith('01020000208408000002000000')).toBe(true);
  });

  it('pomija odcinki pod powierzchnia i wody morskie', () => {
    expect(toFeatureRecord(layer('ditches'), { POLOZENIE: 'pod powierzchnią', GEOM: LINE }, 2)).toBeNull();
    expect(toFeatureRecord(layer('waters'), { RODZAJ: 'woda morska', GEOM: LINE }, 2)).toBeNull();
  });

  it('rozroznia rzeke od strumienia i przenosi nazwe', () => {
    const river = toFeatureRecord(
      layer('watercourses'),
      { RODZAJ: 'rzeka', NAZWA: ' Mienia ', GEOM: LINE },
      2,
    );
    const stream = toFeatureRecord(
      layer('watercourses'),
      { RODZAJ: 'strumień, potok lub struga', NAZWA: null, GEOM: LINE },
      2,
    );

    expect(river).toMatchObject({ k: HYDRO_KIND.river, n: 'Mienia' });
    expect(stream).toMatchObject({ k: HYDRO_KIND.stream, n: null });
  });

  it('bagno i teren podmokly to osobne rodzaje', () => {
    const ring = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];
    const geometry = { type: 'Polygon', coordinates: [ring] };

    expect(toFeatureRecord(layer('wetlands'), { RODZAJ: 'bagno', GEOM: geometry }, 2)?.k).toBe(
      HYDRO_KIND.bog,
    );
    expect(toFeatureRecord(layer('wetlands'), { RODZAJ: 'teren podmokły', GEOM: geometry }, 2)?.k).toBe(
      HYDRO_KIND.wetland,
    );
  });
});

describe('warstwy otoczenia pola (drzewa, miejsca na sieci wodnej, obszary chronione)', () => {
  const ring = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 0],
  ];
  const area = { type: 'Polygon', coordinates: [ring] };

  it('las, zagajnik i zadrzewienie to osobne rodzaje', () => {
    const forests = contextLayer('forests');

    expect(toFeatureRecord(forests, { RODZAJ: 'las', GEOM: area }, 5)?.k).toBe(CONTEXT_KIND.forest);
    expect(toFeatureRecord(forests, { RODZAJ: 'zagajnik', GEOM: area }, 5)?.k).toBe(CONTEXT_KIND.grove);
    expect(toFeatureRecord(forests, { RODZAJ: 'zadrzewienie', GEOM: area }, 5)?.k).toBe(
      CONTEXT_KIND.woodland,
    );
  });

  it('z obiektow liniowych zostaja rzedy drzew i zywoploty, linie oddzialowe odpadaja', () => {
    const rows = contextLayer('tree-rows');

    expect(toFeatureRecord(rows, { RODZAJ: 'rząd drzew', GEOM: LINE }, 2)?.k).toBe(CONTEXT_KIND.treeRow);
    expect(toFeatureRecord(rows, { RODZAJ: 'pas krzewów lub żywopłot', GEOM: LINE }, 2)?.k).toBe(
      CONTEXT_KIND.hedge,
    );
    expect(toFeatureRecord(rows, { RODZAJ: 'linia oddziałowa', GEOM: LINE }, 2)).toBeNull();
  });

  it('budowle pietrzace: jaz, zapora, sluza; zniszczone i w budowie pomijamy', () => {
    const structures = contextLayer('structures');
    const row = (RODZAJ: string, KATEGORIAISTNIENIA: string | null) => ({
      RODZAJ,
      KATEGORIAISTNIENIA,
      GEOM: LINE,
    });

    expect(toFeatureRecord(structures, row('jaz', 'eksploatowany'), 2)?.k).toBe(CONTEXT_KIND.weir);
    expect(toFeatureRecord(structures, row('zapora', null), 2)?.k).toBe(CONTEXT_KIND.dam);
    expect(toFeatureRecord(structures, row('śluza', 'nieczynny'), 2)?.k).toBe(CONTEXT_KIND.lock);
    expect(toFeatureRecord(structures, row('jaz', 'zniszczony'), 2)).toBeNull();
    expect(toFeatureRecord(structures, row('jaz', 'w budowie'), 2)).toBeNull();
  });

  it('z budowli ziemnych zostaja waly i groble', () => {
    const levees = contextLayer('levees');

    expect(toFeatureRecord(levees, { RODZAJ: 'wał przeciwpowodziowy lub grobla', GEOM: LINE }, 2)?.k).toBe(
      CONTEXT_KIND.levee,
    );
    expect(toFeatureRecord(levees, { RODZAJ: 'nasyp', GEOM: LINE }, 2)).toBeNull();
  });

  it('obszar chroniony niesie nazwe, a rodzaj wynika z klasy pliku', () => {
    const record = toFeatureRecord(contextLayer('natura2000'), { NAZWA: 'Dolina Baryczy', GEOM: area }, 20);

    expect(record).toMatchObject({ k: CONTEXT_KIND.natura2000, n: 'Dolina Baryczy' });
    expect(contextLayer('nature-reserves').classify({})).toBe(CONTEXT_KIND.natureReserve);
  });

  it('zrodla i ujecia wody to punkty; z klasy punktow przyrodniczych zostaja tylko zrodla', () => {
    const point = { type: 'Point', coordinates: [637_000, 487_000] };
    const spring = toFeatureRecord(
      contextLayer('springs'),
      { RODZAJ: 'źródło', NAZWA: 'Źródło Marii', GEOM: point },
      2,
    );

    expect(spring).toMatchObject({ k: CONTEXT_KIND.spring, n: 'Źródło Marii' });
    // naglowek punktu z SRID: typ 1, bez licznika wierzcholkow
    expect(spring?.g.startsWith('0101000020840800')).toBe(true);
    expect(
      toFeatureRecord(contextLayer('springs'), { RODZAJ: 'drzewo lub grupa drzew', GEOM: point }, 2),
    ).toBeNull();
    expect(toFeatureRecord(contextLayer('intakes'), { RODZAJ: 'ujęcie wody', GEOM: point }, 2)?.k).toBe(
      CONTEXT_KIND.waterIntake,
    );
    expect(toFeatureRecord(contextLayer('intakes'), { RODZAJ: 'komin', GEOM: point }, 2)).toBeNull();
  });

  it('odcinek w rurze trafia do miejsc na sieci wodnej, a nie do otwartej wody', () => {
    const pipedDitches = contextLayer('piped-ditches');

    expect(pipedDitches.table).toBe('bdot_waterworks');
    expect(toFeatureRecord(pipedDitches, { POLOZENIE: 'pod powierzchnią', GEOM: LINE }, 2)?.k).toBe(
      CONTEXT_KIND.pipedDitch,
    );
    expect(toFeatureRecord(pipedDitches, { POLOZENIE: 'na powierzchni', GEOM: LINE }, 2)).toBeNull();
    // warstwa otwartych rowow nadal je pomija - "najblizszy row" liczy sie tylko z odcinkow na powierzchni
    expect(toFeatureRecord(layer('ditches'), { POLOZENIE: 'pod powierzchnią', GEOM: LINE }, 2)).toBeNull();
  });

  it('kod rodzaju jest unikalny we wszystkich tabelach (import usuwa stare dane po rodzaju)', () => {
    const kinds = BDOT_LAYERS.flatMap((candidate) => candidate.kinds);

    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('simplifyGeometry', () => {
  it('odrzuca wartosci, ktore nie sa obslugiwana geometria', () => {
    expect(simplifyGeometry(null, 2)).toBeNull();
    expect(simplifyGeometry({ type: 'Point', coordinates: 'x' }, 2)).toBeNull();
    expect(simplifyGeometry({ type: 'LineString', coordinates: [[1, 2]] }, 2)).toBeNull();
    expect(simplifyGeometry({ type: 'LineString', coordinates: 'x' }, 2)).toBeNull();
  });
});
