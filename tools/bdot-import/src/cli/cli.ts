// CLI: `bun run bdot:import` (z korzenia - Bun czyta wtedy DATABASE_URL z .env.local). Jednorazowy import BDOT10k do
// Postgresa z PostGIS: tabele `bdot_hydro` (woda) i `bdot_context` (lasy, budowle pietrzace, waly, obszary chronione)
// - rodzaj, nazwa, geometria w EPSG:2180 - oraz `bdot_import` (kiedy i z czego zaladowano dana klase - raport pokazuje
// to jako date danych). Pliki czytamy prosto z serwera GUGiK zakresami HTTP, grupa wierszy po grupie, wiec nic nie
// laduje na dysku. Indeks i naprawa poligonow dotycza tylko tabel, do ktorych wlasnie cos ladujemy.
//   bun run bdot:import                          # wszystkie klasy
//   bun run bdot:import --layers ditches,canals  # wybrane klasy (zastepuje ich poprzednie dane)
//   bun run bdot:import --tolerance 2 --limit 50000 --dry-run
import { parseArgs } from 'node:util';

import { SQL } from 'bun';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

import { toFeatureRecord, type FeatureRecord } from '../feature';
import { BDOT_BASE_URL, BDOT_LAYERS, BDOT_SRID, type BdotLayer, type BdotTable } from '../layers';

const { values } = parseArgs({
  options: {
    layers: { type: 'string' },
    tolerance: { type: 'string' },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

/** Domyslna tolerancja uproszczenia (m); warstwa moze miec wlasna, a jawne `--tolerance` wygrywa z obiema. */
const DEFAULT_TOLERANCE_M = 2;
const forcedToleranceM = values.tolerance === undefined ? null : Number(values.tolerance);
const toleranceOf = (layer: BdotLayer): number => forcedToleranceM ?? layer.toleranceM ?? DEFAULT_TOLERANCE_M;
const limit = values.limit === undefined ? Number.POSITIVE_INFINITY : Number(values.limit);
const dryRun = values['dry-run'];
const wanted = values.layers?.split(',').map((id) => id.trim());
const layers = BDOT_LAYERS.filter((layer) => wanted === undefined || wanted.includes(layer.id));
const tables: readonly BdotTable[] = [...new Set(layers.map((layer) => layer.table))];

/** Ile grup wierszy czytamy i zapisujemy naraz (kazda to osobne zapytania HTTP i jeden INSERT). */
const CONCURRENCY = 4;
const INSERT_BATCH = 5000;
/** Granica rozmiaru jednej paczki (znaki JSON) - obszary chronione maja poligony po kilkaset kB kazdy. */
const INSERT_BATCH_CHARS = 8_000_000;
const badTolerance =
  forcedToleranceM !== null && (!Number.isFinite(forcedToleranceM) || forcedToleranceM < 0);

if (badTolerance || layers.length === 0) {
  console.error(
    `Zle argumenty. Klasy: ${BDOT_LAYERS.map((layer) => layer.id).join(', ')}; --tolerance w metrach.`,
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

  for (const table of tables) {
    await db.unsafe(`
      create table if not exists ${table} (
        kind smallint not null,
        name text,
        geom geometry(Geometry, ${BDOT_SRID}) not null
      )`);
    // ladowanie do tabeli bez indeksu jest kilka razy szybsze; indeks wraca na koncu
    await db.unsafe(`drop index if exists ${table}_geom_idx`);
  }

  await db`
    create table if not exists bdot_import (
      layer text primary key,
      source_url text not null,
      features integer not null,
      tolerance_m real not null,
      imported_at timestamptz not null default now()
    )`;
}

/** Paczki po najwyzej INSERT_BATCH rekordow i ok. INSERT_BATCH_CHARS znakow geometrii. */
function batches(records: readonly FeatureRecord[]): FeatureRecord[][] {
  const result: FeatureRecord[][] = [];
  let current: FeatureRecord[] = [];
  let chars = 0;

  for (const record of records) {
    if (
      current.length > 0 &&
      (current.length >= INSERT_BATCH || chars + record.g.length > INSERT_BATCH_CHARS)
    ) {
      result.push(current);
      current = [];
      chars = 0;
    }

    current.push(record);
    chars += record.g.length;
  }

  if (current.length > 0) result.push(current);

  return result;
}

async function insert(db: SQL, table: BdotTable, records: readonly FeatureRecord[]): Promise<void> {
  for (const batch of batches(records)) {
    const payload = JSON.stringify(batch);

    await db`
      insert into ${db(table)} (kind, name, geom)
      select k, n, g::geometry from jsonb_to_recordset((${payload}::text)::jsonb) as t(k smallint, n text, g text)`;
  }
}

interface Progress {
  read: number;
  kept: number;
  /** znaki geometrii EWKB szesnastkowo: 2 znaki = 1 bajt (do szacowania rozmiaru tabeli na sucho) */
  chars: number;
}

async function importFile(layer: BdotLayer, name: string): Promise<Progress> {
  const file = await asyncBufferFromUrl({ url: `${BDOT_BASE_URL}${name}.parquet` });
  const metadata = await parquetMetadataAsync(file);
  const columns = [...layer.attributes, ...(layer.hasName ? ['NAZWA'] : []), 'GEOM'];
  const toleranceM = toleranceOf(layer);
  const groups: [rowStart: number, rowEnd: number][] = [];
  let offset = 0;

  for (const group of metadata.row_groups) {
    const rows = Number(group.num_rows);

    if (offset < limit) groups.push([offset, Math.min(offset + rows, limit)]);

    offset += rows;
  }

  const total: Progress = { read: 0, kept: 0, chars: 0 };
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
        const records = rows.flatMap((row) => toFeatureRecord(layer, row, toleranceM) ?? []);

        if (sql) await insert(sql, layer.table, records);

        return {
          read: rows.length,
          kept: records.length,
          chars: records.reduce((sum, record) => sum + record.g.length, 0),
        };
      }),
    );

    for (const result of results) {
      total.read += result.read;
      total.kept += result.kept;
      total.chars += result.chars;
    }

    const seconds = (performance.now() - started) / 1000;

    console.log(
      `  ${layer.id} (${name}): ${total.read}/${Math.min(offset, limit)} wierszy, zapisane ${total.kept}, ${seconds.toFixed(0)} s`,
    );
  }

  return total;
}

async function importLayer(layer: BdotLayer): Promise<number> {
  const toleranceM = toleranceOf(layer);

  if (sql) await sql`delete from ${sql(layer.table)} where kind in ${sql([...layer.kinds])}`;

  let kept = 0;
  let chars = 0;

  for (const name of layer.files) {
    const progress = await importFile(layer, name);

    kept += progress.kept;
    chars += progress.chars;
  }

  console.log(
    `  ${layer.id}: geometrie ${(chars / 2 / 1_048_576).toFixed(1)} MB (uproszczenie ${toleranceM} m)`,
  );

  if (sql) {
    const urls = layer.files.map((name) => `${BDOT_BASE_URL}${name}.parquet`).join(' ');

    await sql`
      insert into bdot_import (layer, source_url, features, tolerance_m)
      values (${layer.id}, ${urls}, ${kept}, ${toleranceM})
      on conflict (layer) do update set
        source_url = excluded.source_url,
        features = excluded.features,
        tolerance_m = excluded.tolerance_m,
        imported_at = now()`;
  }

  return kept;
}

/** Uproszczenie potrafi skrzyzowac krawedzie waskich poligonow - naprawiamy je, zeby zapytania nie zalezaly od tego. */
async function repairPolygons(db: SQL, table: BdotTable): Promise<void> {
  const repaired: { count: number }[] = await db`
    with fixed as (
      update ${db(table)}
      set geom = ST_CollectionExtract(ST_MakeValid(geom), 3)
      where ST_Dimension(geom) = 2 and not ST_IsValid(geom)
      returning 1
    )
    select count(*)::int as count from fixed`;

  // poligon wezszy niz tolerancja po naprawie bywa pusty - taki wiersz tylko psuje zapytania o odleglosc
  const removed: { kind: number }[] =
    await db`delete from ${db(table)} where ST_IsEmpty(geom) returning kind`;

  console.log(`${table}: naprawione poligony ${repaired[0]?.count ?? 0}, usuniete puste ${removed.length}`);
}

async function finish(db: SQL, table: BdotTable): Promise<void> {
  await repairPolygons(db, table);
  console.log(`${table}: buduje indeks przestrzenny…`);
  await db.unsafe(`create index if not exists ${table}_geom_idx on ${table} using gist (geom)`);
  await db.unsafe(`analyze ${table}`);

  const sizes: { table_size: string; index_size: string; database_size: string }[] = await db`
    select pg_size_pretty(pg_table_size(${table}::regclass)) as table_size,
           pg_size_pretty(pg_indexes_size(${table}::regclass)) as index_size,
           pg_size_pretty(pg_database_size(current_database())) as database_size`;
  const [size] = sizes;

  if (size) {
    console.log(
      `${table}: tabela ${size.table_size}, indeks ${size.index_size}, cala baza ${size.database_size}.`,
    );
  }
}

console.log(
  `Import BDOT10k: ${layers.map((layer) => layer.id).join(', ')}${forcedToleranceM === null ? '' : `; uproszczenie ${forcedToleranceM} m`}${dryRun ? '; na sucho' : ''}`,
);

if (sql) await prepare(sql);

for (const layer of layers) {
  const kept = await importLayer(layer);

  console.log(`${layer.id}: ${kept} obiektow`);
}

if (sql) {
  for (const table of tables) await finish(sql, table);

  await sql.close();
}
