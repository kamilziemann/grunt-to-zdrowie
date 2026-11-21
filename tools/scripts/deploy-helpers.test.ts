// Pomocniki deploy.ts: wybor srodowiska (--env), lista sekretow Workera i id bazy D1 na prawdziwym
// apps/web/wrangler.jsonc (trafia tylko do bloku wybranego env).
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  D1_ID_PLACEHOLDERS,
  DEPLOY_ENVS,
  d1DatabaseId,
  parseDeployEnv,
  patchD1DatabaseId,
  secretNames,
  type DeployEnv,
} from './deploy-helpers';

describe('parseDeployEnv', () => {
  it('przyjmuje tylko preview i production', () => {
    expect([parseDeployEnv('preview'), parseDeployEnv('production')]).toEqual(['preview', 'production']);
  });

  it.each(['prev', 'Preview', 'staging', 'development', ''])('"%s" = blad, nie deploy produkcji', (value) => {
    expect(parseDeployEnv(value)).toBeNull();
  });
});

const UUID = '0d6a3b1e-4f5c-4a8b-9c2d-1e2f3a4b5c6d';

interface ParsedConfig {
  d1_databases?: { binding: string; database_id: string }[];
  env: Record<DeployEnv, { d1_databases?: { binding: string; database_id: string }[] }>;
}

/**
 * Prawdziwy plik z zaslepkami id w blokach env. Repo moze juz trzymac prawdziwe id bazy produkcji (wpisane po
 * wdrozeniu), a podmiane sprawdzamy na stanie sprzed pierwszego deployu, niezaleznie od tego, co jest dzis w pliku.
 */
function withPlaceholders(config: string): string {
  const parsed = Bun.JSONC.parse(config) as ParsedConfig;

  return DEPLOY_ENVS.reduce((template, env) => {
    const id = d1DatabaseId(parsed.env[env]);

    return id
      ? template.replace(`"database_id": "${id}"`, `"database_id": "${D1_ID_PLACEHOLDERS[env]}"`)
      : template;
  }, config);
}

const serverConfig = withPlaceholders(
  readFileSync(join(import.meta.dir, '..', '..', 'apps/web/wrangler.jsonc'), 'utf8'),
);

const ids = (config: string) => {
  const parsed = Bun.JSONC.parse(config) as ParsedConfig;

  return {
    local: d1DatabaseId(parsed),
    preview: d1DatabaseId(parsed.env.preview),
    production: d1DatabaseId(parsed.env.production),
  };
};

describe('secretNames', () => {
  it('czyta nazwy z JSON wranglera (takze po banerze i pustej liscie)', () => {
    const listed =
      '[{"name":"AUTH_SECRET","type":"secret_text"},{"name":"GEMINI_API_KEY","type":"secret_text"}]';

    expect(secretNames(listed)).toEqual(['AUTH_SECRET', 'GEMINI_API_KEY']);
    expect(secretNames(`wrangler 4.151.1\n${listed}\n`)).toEqual(['AUTH_SECRET', 'GEMINI_API_KEY']);
    expect(secretNames('[]')).toEqual([]);
  });

  it('nieczytelny wynik = null (deploy przerywa, AUTH_SECRET nie jest nadpisywany)', () => {
    expect(secretNames('')).toBeNull();
    expect(secretNames('X [ERROR] A request to the Cloudflare API failed')).toBeNull();
    expect(secretNames('{"name":"AUTH_SECRET"}')).toBeNull();
    expect(secretNames('[{"type":"secret_text"}]')).toBeNull();
  });
});

describe('patchD1DatabaseId', () => {
  it.each(['preview', 'production'] as const)(
    '%s: zmienia tylko id w bloku tego env, top-level zostaje lokalny',
    (env) => {
      const before = ids(serverConfig);
      const after = ids(patchD1DatabaseId(serverConfig, env, UUID));

      expect(after).toEqual({ ...before, [env]: UUID });
    },
  );

  it('drugi raz z tym samym id nic nie zmienia', () => {
    const patched = patchD1DatabaseId(serverConfig, 'production', UUID);

    expect(patchD1DatabaseId(patched, 'production', UUID)).toBe(patched);
  });

  it('inne id juz wpisane w env albo zaslepka poza blokiem env = blad, nie cicha zamiana', () => {
    const patched = patchD1DatabaseId(serverConfig, 'production', UUID);
    const duplicated = serverConfig.replace(
      '"database_id": "REPLACE_WITH_D1_ID"',
      `"database_id": "${D1_ID_PLACEHOLDERS.production}"`,
    );

    expect(() => patchD1DatabaseId(patched, 'production', 'inne-id')).toThrow(/env.production/);
    expect(() => patchD1DatabaseId(duplicated, 'production', UUID)).toThrow(/2 razy/);
  });
});

describe('apps/web/wrangler.jsonc: id baz D1', () => {
  it('top-level ma lokalny klucz, env maja wlasne zaslepki albo id z Cloudflare', () => {
    const { local, preview, production } = ids(serverConfig);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    expect(local).not.toMatch(uuid);
    expect([preview, production]).not.toContain(local);
    expect(preview === D1_ID_PLACEHOLDERS.preview || uuid.test(preview ?? '')).toBe(true);
    expect(production === D1_ID_PLACEHOLDERS.production || uuid.test(production ?? '')).toBe(true);
  });
});
