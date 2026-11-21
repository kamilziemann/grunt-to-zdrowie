// db:check - czy ./migrations odpowiada ./src/schema.ts. Uruchamia `drizzle-kit generate`; jesli powstal nowy plik SQL,
// schemat zmienil sie bez migracji: plik jest usuwany, a skrypt konczy sie bledem (CI). Brak zmian = OK.
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const migrations = join(root, 'migrations');
const list = () =>
  readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .toSorted();
const before = list();
const journal = join(migrations, 'meta', '_journal.json');
const journalBefore = await Bun.file(journal).text();

const proc = Bun.spawnSync([process.execPath, 'x', 'drizzle-kit', 'generate', '--name', 'ci_check'], {
  cwd: root,
  stdout: 'pipe',
  stderr: 'pipe',
});
const output = proc.stdout.toString() + proc.stderr.toString();

if (proc.exitCode !== 0) {
  console.error(output);
  process.exit(proc.exitCode ?? 1);
}

const added = list().filter((f) => !before.includes(f));

if (added.length > 0) {
  for (const f of added) rmSync(join(migrations, f));
  const snapshots = readdirSync(join(migrations, 'meta'))
    .filter((f) => f.endsWith('_snapshot.json'))
    .toSorted();
  const last = snapshots.at(-1);

  if (last && journalBefore && !journalBefore.includes(last.replace('_snapshot.json', '')))
    rmSync(join(migrations, 'meta', last));

  await Bun.write(journal, journalBefore);
  console.error(
    `Schemat rozni sie od migracji (drizzle-kit wygenerowal ${added.join(', ')}). Uruchom: bun run db:generate`,
  );
  process.exit(1);
}

console.log(`db:check OK (${before.length} migracji, schemat zgodny)`);
