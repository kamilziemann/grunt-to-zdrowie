// CLI: `bun run bdot:import` (z korzenia - Bun czyta wtedy DATABASE_URL z .env.local). Jednorazowy import hydrografii
// BDOT10k do Postgresa z PostGIS: tabela `bdot_hydro` (rodzaj, nazwa, geometria w EPSG:2180) + `bdot_import` (kiedy i
// z czego zaladowano dana klase - raport pokazuje to jako date danych). Pliki czytamy prosto z serwera GUGiK
// zakresami HTTP, grupa wierszy po grupie, wiec nic nie laduje na dysku.
//   bun run bdot:import                          # wszystkie klasy
//   bun run bdot:import --layers ditches,canals  # wybrane klasy (zastepuje ich poprzednie dane)
//   bun run bdot:import --tolerance 2 --limit 50000 --dry-run
import { parseArgs } from 'node:util';

import { SQL } from 'bun';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

import { toHydroRecord, type HydroRecord } from '../feature';
import { BDOT_BASE_URL, BDOT_SRID, HYDRO_LAYERS, type HydroLayer } from '../layers';

const { values } = parseArgs({
  options: {
    layers: { type: 'string' },
    tolerance: { type: 'string', default: '2' },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const toleranceM = Number(values.tolerance);
const limit = values.limit === undefined ? Number.POSITIVE_INFINITY : Number(values.limit);
const dryRun = values['dry-run'];
const wanted = values.layers?.split(',').map((id) => id.trim());
const layers = HYDRO_LAYERS.filter((layer) => wanted === undefined || wanted.includes(layer.id));

/** Ile grup wierszy czytamy i zapisujemy naraz (kazda to osobne zapytania HTTP i jeden INSERT). */
const CONCURRENCY = 4;
const INSERT_BATCH = 5000;

if (!Number.isFinite(toleranceM) || toleranceM < 0 || layers.length === 0) {
  console.error(
    `Zle argumenty. Klasy: ${HYDRO_LAYERS.map((layer) => layer.id).join(', ')}; --tolerance w metrach.`,
  );
  process.exit(1);
}

// polaczenie bezposrednie (bez poolera) lepiej znosi dlugie zapytania DDL i budowe indeksu
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!dryRun && !databaseUrl) {
  console.error(
    'Brak DATABASE_URL (albo DATABASE_URL_UNPOOLED) - uruchom z korzenia repo, gdzie lezy .env.local.',
  );
  process.exit(1);
}

const sql = dryRun || !databaseUrl ? null : new SQL(databaseUrl);

async function prepare(db: SQL): Promise<void> {
  await db`create extension if not exists postgis`;
  await db.unsafe(`
    create table if not exists bdot_hydro (
      kind smallint not null,
      name text,
      geom geometry(Geometry, ${BDOT_SRID}) not null
    )`);
  await db`
    create table if not exists bdot_import (
      layer text primary key,
      source_url text not null,
      features integer not null,
      tolerance_m real not null,
      imported_at timestamptz not null default now()
    )`;
  // ladowanie do tabeli bez indeksu jest kilka razy szybsze; indeks wraca na koncu
  await db`drop index if exists bdot_hydro_geom_idx`;
}

async function insert(db: SQL, records: readonly HydroRecord[]): Promise<void> {
  for (let start = 0; start < records.length; start += INSERT_BATCH) {
    const payload = JSON.stringify(records.slice(start, start + INSERT_BATCH));

    await db`
      insert into bdot_hydro (kind, name, geom)
      select k, n, g::geometry from jsonb_to_recordset((${payload}::text)::jsonb) as t(k smallint, n text, g text)`;
  }
}

async function importLayer(layer: HydroLayer): Promise<number> {
  const url = `${BDOT_BASE_URL}${layer.file}.parquet`;
  const file = await asyncBufferFromUrl({ url });
  const metadata = await parquetMetadataAsync(file);
  const columns = [...layer.attributes, ...(layer.hasName ? ['NAZWA'] : []), 'GEOM'];
  const groups: [rowStart: number, rowEnd: number][] = [];
  let offset = 0;

  for (const group of metadata.row_groups) {
    const rows = Number(group.num_rows);

    if (offset < limit) groups.push([offset, Math.min(offset + rows, limit)]);

    offset += rows;
  }

  if (sql) await sql`delete from bdot_hydro where kind in ${sql([...layer.kinds])}`;

  let kept = 0;
  let read = 0;
  const started = performance.now();

  for (let index = 0; index < groups.length; index += CONCURRENCY) {
    const results = await Promise.all(
      groups.slice(index, index + CONCURRENCY).map(async ([rowStart, rowEnd]) => {
        const rows: Record<string, unknown>[] = await parquetReadObjects({
          file,
          metadata,
          columns,
          rowStart,
          rowEnd,
          compressors,
        });
        const records = rows.flatMap((row) => toHydroRecord(layer, row, toleranceM) ?? []);

        if (sql) await insert(sql, records);

        return { read: rows.length, kept: records.length };
      }),
    );

    for (const result of results) {
      read += result.read;
      kept += result.kept;
    }

    const seconds = (performance.now() - started) / 1000;

    console.log(
      `  ${layer.id}: ${read}/${Math.min(offset, limit)} wierszy, zapisane ${kept}, ${seconds.toFixed(0)} s`,
    );
  }

  if (sql) {
    await sql`
      insert into bdot_import (layer, source_url, features, tolerance_m)
      values (${layer.id}, ${url}, ${kept}, ${toleranceM})
      on conflict (layer) do update set
        source_url = excluded.source_url,
        features = excluded.features,
        tolerance_m = excluded.tolerance_m,
        imported_at = now()`;
  }

  return kept;
}

/** Uproszczenie potrafi skrzyzowac krawedzie waskich poligonow - naprawiamy je, zeby zapytania nie zalezaly od tego. */
async function repairPolygons(db: SQL): Promise<void> {
  const repaired: { count: number }[] = await db`
    with fixed as (
      update bdot_hydro
      set geom = ST_CollectionExtract(ST_MakeValid(geom), 3)
      where ST_Dimension(geom) = 2 and not ST_IsValid(geom)
      returning 1
    )
    select count(*)::int as count from fixed`;

  console.log(`Naprawione poligony: ${repaired[0]?.count ?? 0}`);
}

async function finish(db: SQL): Promise<void> {
  await repairPolygons(db);
  console.log('Buduje indeks przestrzenny…');
  await db`create index if not exists bdot_hydro_geom_idx on bdot_hydro using gist (geom)`;
  await db`analyze bdot_hydro`;

  const sizes: { table_size: string; index_size: string; database_size: string }[] = await db`
    select pg_size_pretty(pg_table_size('bdot_hydro')) as table_size,
           pg_size_pretty(pg_indexes_size('bdot_hydro')) as index_size,
           pg_size_pretty(pg_database_size(current_database())) as database_size`;
  const [size] = sizes;

  if (size)
    console.log(`Tabela ${size.table_size}, indeks ${size.index_size}, cala baza ${size.database_size}.`);
}

console.log(
  `Import BDOT10k: ${layers.map((layer) => layer.id).join(', ')}; uproszczenie ${toleranceM} m${dryRun ? '; na sucho' : ''}`,
);

if (sql) await prepare(sql);

for (const layer of layers) {
  const kept = await importLayer(layer);

  console.log(`${layer.id}: ${kept} obiektow`);
}

if (sql) {
  await finish(sql);
  await sql.close();
}
