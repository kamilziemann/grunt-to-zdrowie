// Niezmienniki konfiguracji jedynego Workera (apps/web/wrangler.jsonc), na ktorych polega tools/scripts/deploy.ts:
// blok top-level to lokalny development (ENVIRONMENT=development, nazwy *-dev), wiec deploy bez --env
// nie trafi na zasoby preview/produkcji; kazde srodowisko ma Workers Cache i API pod /api tego samego originu.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..', '..');
const DEPLOY_ENVS = ['preview', 'production'] as const;

interface WranglerBlock {
  name: string;
  main?: string;
  cache?: { enabled?: boolean };
  d1_databases?: { binding: string; database_name: string; remote?: boolean }[];
  r2_buckets?: { binding: string; bucket_name: string; remote?: boolean }[];
  queues?: { producers?: { queue: string }[]; consumers?: { queue: string; dead_letter_queue?: string }[] };
  workflows?: { name: string }[];
  vars?: Record<string, string>;
}

interface WranglerConfig extends WranglerBlock {
  env: Record<(typeof DEPLOY_ENVS)[number], WranglerBlock>;
}

const readText = (path: string) => readFileSync(join(root, path), 'utf8');
const readScripts = (path: string) =>
  (JSON.parse(readText(path)) as { scripts?: Record<string, string> }).scripts ?? {};

const worker = Bun.JSONC.parse(readText('apps/web/wrangler.jsonc')) as WranglerConfig;
const blocks = [worker, ...DEPLOY_ENVS.map((env) => worker.env[env])];

const resourceNames = (block: WranglerBlock) => [
  block.name,
  ...(block.workflows ?? []).map((workflow) => workflow.name),
  ...(block.queues?.producers ?? []).map((producer) => producer.queue),
  ...(block.queues?.consumers ?? []).flatMap((consumer) => [
    consumer.queue,
    consumer.dead_letter_queue ?? '',
  ]),
];

describe('apps/web/wrangler.jsonc (jedyny Worker)', () => {
  it('wejscie to src/worker.ts (strony + API + cron)', () => {
    expect(worker.main).toBe('./src/worker.ts');
  });

  it.each(DEPLOY_ENVS)('top-level nie dzieli z %s nazwy Workera, Workflowow ani kolejek', (env) => {
    const shared = resourceNames(worker).filter(
      (name) => name !== '' && resourceNames(worker.env[env]).includes(name),
    );

    expect(shared).toEqual([]);
  });

  it('top-level to development, a kazde env ma swoja wartosc ENVIRONMENT', () => {
    expect(worker.vars?.ENVIRONMENT).toBe('development');

    for (const env of DEPLOY_ENVS) {
      expect(worker.env[env].vars?.ENVIRONMENT).toBe(env);
    }
  });

  // Stack trace'y w Cloudflare Observability ze zrodla zamiast z minifikatu (bledy z /api/telemetry/errors i SSR).
  it('source mapy wysylane przy deployu', () => {
    expect((worker as WranglerBlock & { upload_source_maps?: boolean }).upload_source_maps).toBe(true);
  });

  // Strony i odczyty API ida z brzegu tylko z Workers Cache; `cache` nie dziedziczy sie miedzy srodowiskami.
  it('Workers Cache wlaczony w kazdym bloku', () => {
    expect(blocks.map((block) => block.cache?.enabled)).toEqual([true, true, true]);
  });

  // API jest pod /api tego samego originu: OpenAPI (`servers`) buduje adresy z PUBLIC_URL.
  it('PUBLIC_URL wskazuje /api, a ALLOWED_ORIGINS - origin stron', () => {
    for (const block of blocks) {
      const publicUrl = block.vars?.PUBLIC_URL ?? '';

      expect(publicUrl.endsWith('/api')).toBe(true);
      expect(block.vars?.ALLOWED_ORIGINS?.toLowerCase()).toBe(new URL(publicUrl).origin);
    }
  });

  // Top-level (vite dev, testy, e2e) ma te same nazwy bazy (i bucketow, gdy je dodasz) co produkcja: `remote`
  // skierowalby lokalne migracje `--local` na zasoby produkcji.
  it('top-level D1 i R2 bez `remote` (lokalnie zawsze symulowane)', () => {
    const remote = [...(worker.d1_databases ?? []), ...(worker.r2_buckets ?? [])].filter(
      (binding) => binding.remote !== undefined,
    );

    expect(worker.d1_databases?.length).toBeGreaterThan(0);
    expect(remote).toEqual([]);
  });
});

describe('skrypty deploy', () => {
  // Bezposrednie wywolanie wranglera bez --env/CLOUDFLARE_ENV wdraza blok top-level (konfiguracje dev).
  const directDeploy = /\bwrangler\s+(deploy|versions\s+upload)\b/;

  it.each(['apps/server/package.json', 'apps/web/package.json', 'package.json'])(
    '%s: deploy idzie przez tools/scripts/deploy.ts, nie wprost przez wrangler',
    (path) => {
      const direct = Object.entries(readScripts(path)).filter(([, command]) => directDeploy.test(command));

      expect(direct).toEqual([]);
    },
  );

  it('turbo nie ma zadania deploy (deploy ma jedna, uporzadkowana sciezke)', () => {
    const turbo = JSON.parse(readText('turbo.json')) as { tasks: Record<string, unknown> };

    expect(Object.keys(turbo.tasks)).not.toContain('deploy');
  });
});
