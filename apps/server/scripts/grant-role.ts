// Nadanie roli zespolu (editor | admin) kontu w LOKALNEJ bazie D1 - potrzebne tylko, gdy lokalnie wlaczysz auth
// (AUTH_ENABLED=true), bo role nadaje backend, nie rejestracja. Konto musi juz istniec (zarejestruj sie w aplikacji).
// Uzycie (z apps/server): bun run admin:grant -- ala@example.com admin
// Zdalnie (swiadomie!): dopisz --remote; wtedy wrangler pyta baze srodowiska production (albo --env preview).
import { WORKER_DIR } from './worker-dir';

const ROLES = ['editor', 'admin'] as const;
const argv = process.argv.slice(2);
const envIndex = argv.indexOf('--env');
const remoteEnv = envIndex >= 0 ? (argv[envIndex + 1] ?? 'production') : 'production';
const [email, role] = argv.filter(
  (arg, index) => !arg.startsWith('--') && (envIndex < 0 || index !== envIndex + 1),
);
const remote = argv.includes('--remote');

if (!email || !role || !(ROLES as readonly string[]).includes(role)) {
  console.error(`Uzycie: bun run admin:grant -- <email> <${ROLES.join('|')}> [--remote]`);
  process.exit(1);
}

const q = (value: string): string => `'${value.replaceAll("'", "''")}'`;
// admin dostaje tez editor: jedna rola nie wyklucza drugiej, a polityki sprawdzaja kazda osobno
const roles = role === 'admin' ? ['editor', 'admin'] : ['editor'];
const sql = `UPDATE user SET roles = ${q(JSON.stringify(roles))} WHERE email = ${q(email)};`;
const target = remote ? ['--remote', '--env', remoteEnv] : ['--local'];
const proc = Bun.spawnSync(
  [process.execPath, 'x', 'wrangler', 'd1', 'execute', 'DB', ...target, '--command', sql],
  {
    cwd: WORKER_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  },
);

if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
console.log(
  `Role ${roles.join(', ')} dla ${email} (${remote ? 'remote' : 'local'}). Wyloguj sie i zaloguj ponownie.`,
);
