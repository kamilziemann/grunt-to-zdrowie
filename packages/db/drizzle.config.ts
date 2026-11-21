// drizzle-kit: generowanie migracji SQL do ./migrations. Migracje stosuje wrangler (apps/server: db:migrate),
// bo D1 lokalnie i zdalnie zarzadza wrangler. `driver: d1-http` wlacza sie tylko, gdy sa dane do zdalnego D1
// (drizzle-kit studio / push na zdalna baze) - zwykle niepotrzebne.
import { defineConfig } from 'drizzle-kit';

const remote =
  process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_D1_TOKEN
    ? {
        driver: 'd1-http' as const,
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          databaseId: process.env.CLOUDFLARE_DATABASE_ID,
          token: process.env.CLOUDFLARE_D1_TOKEN,
        },
      }
    : {};

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
  strict: true,
  verbose: true,
  ...remote,
});
