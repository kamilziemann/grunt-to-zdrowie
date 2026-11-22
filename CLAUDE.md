@AGENTS.md

# Claude Code

Reguły repo są w `AGENTS.md` (zaimportowany wyżej), reguły aplikacji w `apps/server/AGENTS.md` i `apps/web/AGENTS.md`
— przeczytaj właściwy przed zmianą w aplikacji. Tu tylko to, co dotyczy Claude Code.

## Hooki (`.claude/settings.json`)

- `PostToolUse` na `Write|Edit|MultiEdit` uruchamia `tools/scripts/format-edited-file.sh`: `oxfmt` na edytowanym
  pliku, a dla `ts/tsx/js` autofix pustych linii (`arch/padding-lines`). Zawsze kończy się kodem 0, nie blokuje
  pracy i nie zastępuje `bun check`.
- `Stop` uruchamia `tools/scripts/progress-reminder.sh`: jeśli ostatni commit (z ostatnich 12 h) jest nowszy niż
  ostatnia zmiana w `docs/progress`, raz blokuje zakończenie tury z prośbą o wpis w dzienniku (drugi raz przepuszcza).

## Skille

- Źródło: `.agents/skills/`; `.claude/skills/<nazwa>` to symlinki (jeden plik, dwa wejścia). Lista i opis:
  `.agents/README.md`. Projektowe: `new-server-module`, `new-web-feature`, `db-change`, `write-plan`, `write-adr`,
  `progress-log`, `verify-change`, `architecture-rules`, `design-system`. Oficjalne TanStack (`tanstack-start`, `tanstack-router`,
  `tanstack-router-query`, …) to linki do skilli z paczek npm. Zewnętrznych skilli (vendored) nie trzymamy w repo.

## Podgląd i serwery

- `.claude/launch.json`: `web` (`vite dev`, :3000) — jeden serwer: strony TanStack Start i API pod `/api` w workerd
  z lokalnymi bindingami. Uruchamiaj przez narzędzia podglądu, nie przez Bash.
- MCP (`.mcp.json`): context7 (dokumentacja bibliotek), Cloudflare docs, shadcn. Sprawdzaj aktualne API bibliotek tam
  (albo w skillach `tanstack-*`), zanim napiszesz kod z pamięci.

## Równoległe sesje

Pracujesz w worktree (`.claude/worktrees/`, w `.gitignore`). Każda sesja ma własny plik dziennika
(`docs/progress/RRRR-MM-DD/<nazwa>-<id>.md`), więc merge'e się nie gryzą.
