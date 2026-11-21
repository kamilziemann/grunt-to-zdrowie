// CLI: bun src/cli/cli.ts --config <plik> --root <katalog> [--format text|github|json] [--json] [--only <regula>[,<regula>]]
// Kod wyjscia: 0 = OK, 1 = naruszenia, 2 = blad uzycia/konfiguracji.
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { runArchitectureCheck } from '..';
import type { ArchitectureConfig } from '../config';
import { toPosix } from '../paths';
import { formatReport, type ReportFormat } from '../report';
import { RULE_IDS } from '../types';

interface CliArgs {
  config: string;
  root: string;
  format: ReportFormat;
  only: string[];
  help: boolean;
}

const USAGE = `Uzycie: bun src/cli/cli.ts --config <architecture.config.ts> --root <katalog> [opcje]

Opcje:
  --config <plik>      plik konfiguracji (default export z defineArchitecture)
  --root <katalog>     root monorepo (globy include/exclude sa wzgledem niego); domyslnie cwd
  --format <format>    text (domyslnie) | github (adnotacje ::error) | json
  --json               skrot dla --format json
  --only <regula>      uruchom tylko wybrane reguly (mozna powtarzac albo rozdzielac przecinkami)
  -h, --help           ta pomoc

Reguly: ${RULE_IDS.join(', ')}
`;

class UsageError extends Error {}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    config: 'architecture.config.ts',
    root: '.',
    format: 'text',
    only: [],
    help: false,
  };
  const takeValue = (index: number, name: string): string => {
    const value = argv[index + 1];

    if (value === undefined || value.startsWith('--')) throw new UsageError(`Opcja ${name} wymaga wartosci.`);

    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];

    if (raw === undefined) break;
    const eq = raw.indexOf('=');
    const name = raw.startsWith('--') && eq !== -1 ? raw.slice(0, eq) : raw;
    const inline = raw.startsWith('--') && eq !== -1 ? raw.slice(eq + 1) : null;
    const value = (): string => {
      if (inline !== null) return inline;
      const taken = takeValue(i, name);

      i++;

      return taken;
    };

    switch (name) {
      case '--config':
        args.config = value();
        break;
      case '--root':
        args.root = value();
        break;
      case '--format': {
        const format = value();

        if (format !== 'text' && format !== 'github' && format !== 'json') {
          throw new UsageError(`Nieznany format '${format}'. Dostepne: text, github, json.`);
        }

        args.format = format;
        break;
      }
      case '--json':
        args.format = 'json';
        break;
      case '--only':
        args.only.push(
          ...value()
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id !== ''),
        );
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        throw new UsageError(`Nieznana opcja '${raw}'.`);
    }
  }

  return args;
}

const isConfig = (value: unknown): value is ArchitectureConfig =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { scope?: unknown }).scope === 'string' &&
  Array.isArray((value as { include?: unknown }).include) &&
  Array.isArray((value as { exclude?: unknown }).exclude) &&
  typeof (value as { packages?: unknown }).packages === 'object' &&
  typeof (value as { apps?: unknown }).apps === 'object';

async function loadConfig(path: string): Promise<ArchitectureConfig> {
  const absolute = resolve(path);
  let loaded: unknown;

  try {
    loaded = await import(pathToFileURL(absolute).href);
  } catch (error) {
    throw new UsageError(
      `Nie mozna wczytac konfiguracji ${absolute}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const config = (loaded as { default?: unknown }).default;

  if (!isConfig(config)) {
    throw new UsageError(`Konfiguracja ${absolute} nie eksportuje domyslnie wyniku defineArchitecture(...).`);
  }

  return config;
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);

  if (args.help) {
    process.stdout.write(USAGE);

    return 0;
  }

  const config = await loadConfig(args.config);
  const root = resolve(args.root);
  const configPath = toPosix(relative(root, resolve(args.config))) || 'architecture.config.ts';
  const result = await runArchitectureCheck(config, root, { only: args.only, configPath });

  process.stdout.write(formatReport(result, args.format));

  return result.ok ? 0 : 1;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`architecture-check: ${message}\n`);
  if (error instanceof UsageError) process.stderr.write(`\n${USAGE}`);
  process.exitCode = 2;
}
