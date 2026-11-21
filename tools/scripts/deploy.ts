// Deploy aplikacji na Cloudflare jedna komenda: `bun run deploy` (production) albo `bun run deploy -- --env preview`.
// JEDEN Worker (apps/web: strony TanStack Start + API Hono + cron). Idempotentny: zaklada brakujace
// zasoby (baza D1; nowe bindingi dopisz w kroku zasobow), wpisuje id bazy i adres *.workers.dev do apps/web/wrangler.jsonc, ustawia
// sekret AUTH_SECRET, gdy go brak, stosuje migracje D1, buduje Workera dla srodowiska (`CLOUDFLARE_ENV` - wtyczka
// Cloudflare dla Vite wybiera blok env w czasie builda) i wdraza go. Wymaga `bunx wrangler login`. Opcje: --env.
// Cache brzegowy (Workers Cache) jest per wersja Workera - nowy deploy startuje z pustym cache, bez recznego purge.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { DEPLOY_ENVS, parseDeployEnv, patchD1DatabaseId, secretNames } from './deploy-helpers';

const { values } = parseArgs({ options: { env: { type: 'string', default: 'production' } } });

const env = parseDeployEnv(values.env);

if (env === null) fail(`Nieznane --env "${values.env}": dozwolone ${DEPLOY_ENVS.join(' | ')}.`);

const root = join(import.meta.dir, '..', '..');
const workerDir = join(root, 'apps', 'web');
const workerConfig = join(workerDir, 'wrangler.jsonc');
const slug = /APP_SLUG = '([a-z0-9-]+)'/.exec(
  readFileSync(join(root, 'packages/config/src/index.ts'), 'utf8'),
)?.[1];

if (!slug) {
  console.error('Nie znaleziono APP_SLUG w packages/config/src/index.ts.');
  process.exit(1);
}

const suffix = env === 'preview' ? '-preview' : '';
const names = {
  database: `${slug}${suffix}`,
  worker: `${slug}${suffix}`,
};

interface RunResult {
  code: number;
  /** stdout + stderr (komunikaty bledow) */
  out: string;
  /** sam stdout (wynik --format json bez ostrzezen wranglera) */
  stdout: string;
}

function run(
  cmd: string[],
  cwd: string,
  options: { input?: string; extraEnv?: Record<string, string> } = {},
): RunResult {
  const proc = Bun.spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...options.extraEnv },
    stdin: options.input === undefined ? 'ignore' : new TextEncoder().encode(options.input),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = proc.stdout.toString();
  const out = `${stdout}${proc.stderr.toString()}`;

  return { code: proc.exitCode ?? 1, out, stdout };
}

const wrangler = (args: string[], options: { input?: string; extraEnv?: Record<string, string> } = {}) =>
  run([process.execPath, 'x', 'wrangler', ...args], workerDir, options);

function step(title: string) {
  console.log(`\n▸ ${title}`);
}

function fail(message: string, out = ''): never {
  console.error(`\n✖ ${message}${out ? `\n${out.trim().split('\n').slice(-15).join('\n')}` : ''}`);
  process.exit(1);
}

/** Tworzy zasob; „juz istnieje” to sukces (skrypt jest idempotentny). */
function ensure(label: string, args: string[]) {
  const result = wrangler(args);

  if (result.code === 0) return console.log(`  utworzono: ${label}`);

  if (/already exists|already taken|exists/i.test(result.out)) return console.log(`  jest: ${label}`);

  fail(`Nie udalo sie utworzyc: ${label}`, result.out);
}

function patchFile(path: string, replacements: [string, string][]): boolean {
  const before = readFileSync(path, 'utf8');
  const after = replacements.reduce((text, [from, to]) => text.replaceAll(from, to), before);

  if (after !== before) writeFileSync(path, after);

  return after !== before;
}

console.log(`Deploy -> Cloudflare (${env})`);

step('Logowanie do Cloudflare');

const whoami = wrangler(['whoami']);

if (whoami.code !== 0 || /not authenticated/i.test(whoami.out)) {
  fail('Wrangler nie jest zalogowany. Uruchom raz: bunx wrangler login (albo ustaw CLOUDFLARE_API_TOKEN).');
}

console.log('  zalogowano');

step('Baza D1');

const listDatabases = (): { name: string; uuid: string }[] => {
  const result = wrangler(['d1', 'list', '--json']);

  if (result.code !== 0) fail('Nie udalo sie pobrac listy baz D1', result.out);

  return JSON.parse(result.out.slice(result.out.indexOf('['))) as { name: string; uuid: string }[];
};

let database = listDatabases().find((item) => item.name === names.database);

if (!database) {
  ensure(`baza ${names.database}`, ['d1', 'create', names.database]);
  database = listDatabases().find((item) => item.name === names.database);
}

if (!database) fail(`Baza ${names.database} nie pojawila sie na liscie po utworzeniu.`);

console.log(`  ${names.database}: ${database.uuid}`);

const configChanged: string[] = [];
const configText = readFileSync(workerConfig, 'utf8');
let patchedConfig = configText;

// Id bazy trafia tylko do env.<env>: top-level to lokalna baza vite dev (patrz deploy-helpers.ts).
try {
  patchedConfig = patchD1DatabaseId(configText, env, database.uuid);
} catch (error) {
  fail(
    `Nie udalo sie wpisac id bazy do apps/web/wrangler.jsonc: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (patchedConfig !== configText) {
  writeFileSync(workerConfig, patchedConfig);
  configChanged.push('apps/web/wrangler.jsonc');
}

step('Migracje D1 (zdalnie)');

const migrate = wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--env', env]);

if (migrate.code !== 0) fail('Migracje nie przeszly', migrate.out);

console.log('  migracje zastosowane');

/**
 * Build Workera dla srodowiska i deploy; zwraca subdomene konta *.workers.dev z wyniku wranglera albo null, gdy
 * Worker stoi tylko na wlasnej domenie (np. produkcja z `custom_domain`) i wrangler nie podaje adresu workers.dev.
 */
const buildAndDeploy = (): string | null => {
  const build = run([process.execPath, 'run', 'build'], workerDir, { extraEnv: { CLOUDFLARE_ENV: env } });

  if (build.code !== 0) fail('Build Workera nie przeszedl', build.out);

  const result = wrangler(['deploy'], { extraEnv: { CLOUDFLARE_ENV: env } });

  if (result.code !== 0) fail('Deploy Workera nie przeszedl', result.out);

  const url = new RegExp(`https://${names.worker}\\.([a-z0-9-]+)\\.workers\\.dev`).exec(result.out);

  return url?.[1] ?? null;
};

step(`Build i deploy Workera (${names.worker})`);

const subdomain = buildAndDeploy();
const workerUrl = subdomain === null ? null : `https://${names.worker}.${subdomain}.workers.dev`;

console.log(
  workerUrl === null ? '  wdrozony (bez *.workers.dev - wlasna domena z wrangler.jsonc)' : `  ${workerUrl}`,
);

// Adresy w wrangler.jsonc (PUBLIC_URL = <origin>/api, ALLOWED_ORIGINS = <origin>): zaslepka YOUR-SUBDOMAIN -> adres.
// Bez adresu workers.dev zaslepki nie ma czym zastapic - srodowisko ma wtedy wlasna domene wpisana recznie.
const urlsChanged =
  workerUrl !== null &&
  patchFile(workerConfig, [[`https://${names.worker}.YOUR-SUBDOMAIN.workers.dev`, workerUrl]]);

if (urlsChanged && !configChanged.includes('apps/web/wrangler.jsonc'))
  configChanged.push('apps/web/wrangler.jsonc');

step('Sekret AUTH_SECRET');

// Nieudana lista (blad API, limit, siec) to przerwanie, nie „brak sekretu”: nowy losowy AUTH_SECRET wylogowalby
// wszystkich uzytkownikow zywego srodowiska.
const secrets = wrangler(['secret', 'list', '--env', env, '--format', 'json']);

if (secrets.code !== 0) {
  fail('Nie udalo sie pobrac listy sekretow (AUTH_SECRET bez zmian), uruchom deploy ponownie', secrets.out);
}

const secretList = secretNames(secrets.stdout);

if (secretList === null) fail('Nieczytelna lista sekretow z wranglera (AUTH_SECRET bez zmian)', secrets.out);

if (secretList.includes('AUTH_SECRET')) {
  console.log('  jest');
} else {
  const put = wrangler(['secret', 'put', 'AUTH_SECRET', '--env', env], {
    input: randomBytes(32).toString('base64'),
  });

  if (put.code !== 0) fail('Nie udalo sie ustawic AUTH_SECRET', put.out);

  console.log('  ustawiony (losowy, 32 bajty)');
}

if (urlsChanged) {
  step('Ponowny deploy z prawdziwym adresem');
  buildAndDeploy();
  console.log('  gotowe');
}

console.log(`\n✔ Gotowe (${env}): ${workerUrl ?? 'wlasna domena z wrangler.jsonc'}  (strony, API pod /api)`);

if (configChanged.length > 0) {
  console.log(`\nZmienione pliki konfiguracji (zacommituj je): ${configChanged.join(', ')}`);
}

const appUrl = workerUrl ?? 'adres z wrangler.jsonc';

// Konta sa opcjonalne (AUTH_ENABLED): podpowiedz, jak nadac role pierwszemu kontu
console.log(
  `\nKonto admina (gdy AUTH_ENABLED=true): zarejestruj sie na ${appUrl}/sign-up, potem\n  bun run admin:grant -- twoj@email.pl admin --remote` +
    (env === 'preview' ? ' --env preview' : ''),
);
