// Jedyny Worker aplikacji budowany przez Vite: TanStack Start (strony SSR, routing plikowy w src/routes) w srodowisku
// `ssr` wtyczki Cloudflare - dev biegnie w workerd z prawdziwymi bindingami (D1 i inne), build daje
// Workera + pliki klienta. Konfiguracja wg oficjalnego przewodnika TanStack Start dla Cloudflare Workers.
// Testy e2e uruchamiaja drugi serwer z wlasnym stanem lokalnym (APP_STATE_DIR) i nadpisanymi zmiennymi
// (APP_VARS, JSON) - np. wlaczone auth; zwykly `bun run dev` ich nie uzywa.
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const stateDir = process.env.APP_STATE_DIR;
const varsOverride = process.env.APP_VARS
  ? (JSON.parse(process.env.APP_VARS) as Record<string, string>)
  : null;

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  // Kazdy serwer (dev, e2e, e2e z auth) ma wlasny cache zaleznosci - wspolny `node_modules/.vite` nadpisywany przez
  // rownolegle serwery z inna konfiguracja konczyl sie przeladowaniem strony w trakcie testu.
  ...(stateDir ? { cacheDir: `${stateDir}-vite` } : {}),
  // Skan wszystkich tras przy starcie: zaleznosci znane od razu, bez re-optymalizacji i przeladowania przy pierwszym
  // wejsciu na nowa strone (trasy laduja sie leniwie).
  optimizeDeps: { entries: ['src/routes/**/*.tsx', 'src/router.tsx'] },
  plugins: [
    tailwindcss(),
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      ...(stateDir ? { persistState: { path: stateDir } } : {}),
      ...(varsOverride ? { config: (worker) => ({ vars: { ...worker.vars, ...varsOverride } }) } : {}),
    }),
    tanstackStart({
      router: {
        codeSplittingOptions: {
          // Strony deweloperskie (`_dev`): loader razem z komponentem w leniwym chunku trasy,
          // wiec ich kod nie trafia do glownego chunka stron publicznych. Strony publiczne zostaja przy domyslnym
          // podziale - loader w glownym chunku, bez drugiego kroku sieci przed jego startem (zalecenie TanStack).
          splitBehavior: ({ routeId }) =>
            routeId.includes('/_dev')
              ? [['loader', 'component'], ['errorComponent'], ['pendingComponent'], ['notFoundComponent']]
              : undefined,
        },
      },
    }),
    viteReact(),
  ],
});
