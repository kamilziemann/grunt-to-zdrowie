# entry/cron

Handler `scheduled()` (Cron Triggers, `triggers.crons` w każdym `env` w `apps/web/wrangler.jsonc`). Dziś:
`scheduled.ts` - lista `STEPS` wykonywana po kolei, każdy krok w osobnym `try/catch` (błąd jednego nie zatrzymuje
kolejnych); tagi cache zwrócone przez kroki trafiają do jednego purge na koniec. Dziś jest jeden krok `heartbeat`.

Jak dodać krok albo harmonogram:

1. Logika jako use-case w `services/` (np. `container.cleanup.sweep()`); krok tylko go woła, nigdy jej nie zawiera.
2. `src/entry/cron/scheduled.ts`: nowy wpis w `STEPS` i przypadek w `scheduled.test.ts`.
3. Inny harmonogram: dopisz wyrażenie do `triggers.crons` w każdym `env` i rozróżniaj je po `controller.cron`.
4. Lokalnie cron nie startuje sam: `curl "http://localhost:3000/cdn-cgi/handler/scheduled"` (przy `bun run dev`).
