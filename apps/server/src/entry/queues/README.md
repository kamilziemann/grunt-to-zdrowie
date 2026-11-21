# entry/queues

Konsumenci Cloudflare Queues (`queue()`). Projekt nie ma jeszcze żadnego - poniżej przepis.

Jak dodać kolejną:

1. `wrangler.jsonc`: `queues.producers` (binding, np. `JOBS`) i `queues.consumers` - w kazdym `env`.
2. `packages/env/src/server.ts`: typ wiadomosci + `JOBS?: Queue<JobMessage>` w `ServerBindings` i `pickBindings`.
3. Producent: adapter w `src/infrastructure/<nazwa>/` implementujacy port z `services/<obszar>/ports.ts`; bez
   bindingu (lokalnie, w testach) adapter wykonuje prace inline przez `ctx.waitUntil`.
4. Konsument: `src/entry/queues/consumer.ts` buduje kontener per wiadomosc i wola use-case; eksport z `src/index.ts`.
