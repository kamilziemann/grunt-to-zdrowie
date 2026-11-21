#!/usr/bin/env node
// Uruchamia oxfmt z argumentami jak `oxfmt ...`. Na macOS i Linuksie to zwykle wywolanie lokalnej binarki.
// Na Windowsie, gdy Smart App Control blokuje natywny plik oxfmt (.node bez podpisu), formatuje ta sama wersja
// oxfmt wewnatrz WSL (Linux nie podlega tej blokadzie). Wymuszenie WSL: OXFMT_VIA_WSL=1; wylaczenie: OXFMT_VIA_WSL=0.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const localBin = join(root, 'node_modules', 'oxfmt', 'bin', 'oxfmt');
const cacheFile = join(root, 'node_modules', '.cache', 'oxfmt-mode');
const DAY_MS = 24 * 60 * 60 * 1000;

function runLocal() {
  const result = spawnSync(process.execPath, [localBin, ...args], { cwd: process.cwd(), stdio: 'inherit' });

  return result.status ?? 1;
}

// Czy lokalny oxfmt daje sie zaladowac? Wynik zapamietujemy na dobe, zeby nie probowac przy kazdym pliku.
function nativeWorks() {
  if (existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < DAY_MS) {
    return readFileSync(cacheFile, 'utf8').trim() === 'native';
  }

  const probe = spawnSync(process.execPath, [localBin, '--version'], { encoding: 'utf8' });
  const works = probe.status === 0;

  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, works ? 'native' : 'wsl');

  return works;
}

// C:\dev\x albo C:/dev/x -> /mnt/c/dev/x; sciezki wzgledne zostaja bez zmian (WSL startuje w tym samym katalogu).
function toWslPath(arg) {
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(arg);

  if (!match) return arg;

  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`;
}

function runInWsl() {
  const version = JSON.parse(
    readFileSync(join(root, 'node_modules', 'oxfmt', 'package.json'), 'utf8'),
  ).version;
  // bash -lc wczytuje profil, wiec widzi bun/node zainstalowane przez uzytkownika (~/.bun/bin, nvm).
  // ~/.bun/bin wprost: instalator bun dopisuje PATH na koniec ~/.bashrc, ktory przy wywolaniu nieinteraktywnym konczy
  // sie wczesniej, wiec bez tego bunx nie bylby widoczny.
  const script = [
    'export PATH="$HOME/.bun/bin:$PATH";',
    'if command -v bunx >/dev/null 2>&1; then exec bunx "oxfmt@$OXFMT_VERSION" "$@";',
    'elif command -v npx >/dev/null 2>&1; then exec npx --yes "oxfmt@$OXFMT_VERSION" "$@";',
    'else echo "W WSL brakuje bun albo node. Zainstaluj bun: curl -fsSL https://bun.sh/install | bash" >&2; exit 127; fi',
  ].join(' ');
  const result = spawnSync(
    'wsl.exe',
    [
      '--cd',
      process.cwd(),
      '--exec',
      'env',
      `OXFMT_VERSION=${version}`,
      'bash',
      '-lc',
      script,
      'oxfmt',
      ...args.map(toWslPath),
    ],
    // --exec: bez powloki uzytkownika (zsh rozwijalby nawiasy w sciezkach typu {-$locale}).
    // WSL_UTF8: komunikaty wsl.exe w UTF-8 zamiast UTF-16 (inaczej polskie znaki sa nieczytelne).
    { stdio: 'inherit', env: { ...process.env, WSL_UTF8: '1' } },
  );

  if (result.error) {
    console.error(
      'oxfmt: natywna binarka jest zablokowana (Smart App Control), a WSL nie jest dostepny.\n' +
        'Zainstaluj WSL: wsl.exe --install -d Ubuntu, potem w Ubuntu: curl -fsSL https://bun.sh/install | bash',
    );

    return 1;
  }

  return result.status ?? 1;
}

const mode = process.env.OXFMT_VIA_WSL;
const useWsl = process.platform === 'win32' && (mode === '1' || (mode !== '0' && !nativeWorks()));

process.exit(useWsl ? runInWsl() : runLocal());
