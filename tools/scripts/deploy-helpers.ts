// Czyste pomocniki tools/scripts/deploy.ts (bez wywolan wranglera i zapisu plikow), testowane w deploy-helpers.test.ts.

export const DEPLOY_ENVS = ['preview', 'production'] as const;

export type DeployEnv = (typeof DEPLOY_ENVS)[number];

/**
 * Wartosc `--env` skryptu deploy: tylko preview albo production. Literowka (`prev`, `Preview`) albo `development`
 * to null (blad), nie cichy deploy produkcji z jej migracjami.
 */
export function parseDeployEnv(value: string): DeployEnv | null {
  return DEPLOY_ENVS.find((env) => env === value) ?? null;
}

/** Zaslepki id baz D1 w apps/web/wrangler.jsonc: kazda stoi tylko w bloku swojego env. */
export const D1_ID_PLACEHOLDERS: Record<DeployEnv, string> = {
  preview: 'REPLACE_WITH_PREVIEW_D1_ID',
  production: 'REPLACE_WITH_PRODUCTION_D1_ID',
};

interface D1Block {
  d1_databases?: { binding: string; database_id: string }[];
}

interface ServerWranglerConfig extends D1Block {
  env?: Partial<Record<DeployEnv, D1Block>>;
}

/** Id bazy bindingu `DB` w bloku konfiguracji. */
export function d1DatabaseId(block: D1Block | undefined): string | undefined {
  return block?.d1_databases?.find((database) => database.binding === 'DB')?.database_id;
}

/**
 * Wpisuje id bazy D1 wylacznie w env.<env> apps/web/wrangler.jsonc. Blok top-level to lokalna baza `vite dev`
 * (jej database_id jest kluczem danych w .wrangler/state), wiec nie moze dostac id bazy z chmury: lokalna baza
 * zrobilaby sie pusta, a `wrangler deploy` bez --env trafilby na dane produkcji. Juz wpisane id = bez zmian.
 */
export function patchD1DatabaseId(config: string, env: DeployEnv, uuid: string): string {
  const current = d1DatabaseId((Bun.JSONC.parse(config) as ServerWranglerConfig).env?.[env]);
  const placeholder = D1_ID_PLACEHOLDERS[env];

  if (current === uuid) return config;

  if (current !== placeholder) {
    throw new Error(
      `env.${env}: database_id = ${current ?? '(brak)'}, oczekiwano ${placeholder} albo ${uuid}`,
    );
  }

  const occurrences = config.split(placeholder).length - 1;

  if (occurrences !== 1) {
    throw new Error(
      `${placeholder} wystepuje ${occurrences} razy - powinien tylko w env.${env}.d1_databases`,
    );
  }

  return config.replace(placeholder, uuid);
}

/**
 * Nazwy sekretow Workera z wyniku `wrangler secret list --format json` (stdout). null = wynik nieczytelny: wtedy
 * deploy mowi, ze nie zna listy, zamiast zglaszac wszystkie sekrety jako brakujace.
 */
export function secretNames(stdout: string): string[] | null {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');

  if (start === -1 || end < start) return null;

  try {
    const parsed: unknown = JSON.parse(stdout.slice(start, end + 1));

    if (!Array.isArray(parsed)) return null;

    const names = parsed.map((item: unknown) =>
      typeof item === 'object' && item !== null && 'name' in item && typeof item.name === 'string'
        ? item.name
        : null,
    );

    return names.every((name): name is string => name !== null) ? names : null;
  } catch {
    return null;
  }
}

/** Sekrety, bez ktorych aplikacja traci zrodla danych (mapy BDOT10k z Neona, Sentinel-2 z Copernicusa). */
export const REQUIRED_SECRETS = ['DATABASE_URL', 'COPERNICUS_CLIENT_ID', 'COPERNICUS_CLIENT_SECRET'] as const;

/** Sekrety z `REQUIRED_SECRETS`, ktorych nie ma na liscie Workera (kolejnosc jak w `REQUIRED_SECRETS`). */
export function missingSecrets(listed: readonly string[]): string[] {
  return REQUIRED_SECRETS.filter((name) => !listed.includes(name));
}
