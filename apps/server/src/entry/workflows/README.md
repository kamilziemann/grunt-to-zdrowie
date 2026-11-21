# entry/workflows

Cloudflare Workflows (długie, wznawialne procesy z krokami). Projekt nie ma jeszcze żadnego - poniżej przepis.

Jak dodać kolejny:

1. `wrangler.jsonc`: `"workflows": [{ "name": "<app>-<nazwa>", "binding": "X_WORKFLOW", "class_name": "XWorkflow" }]`
   w kazdym `env`; binding w `ServerBindings` (`packages/env`).
2. Klasa `XWorkflow extends WorkflowEntrypoint` w `src/entry/workflows/x-workflow.ts`, eksport z `src/index.ts`.
   `run(event, step)` buduje kontener z `this.env` i deleguje do serwisu, ktory definiuje kroki
   (`orchestrate(steps)`) przez port - serwis nie zna API Workflows.
3. Bez bindingu (testy) te same kroki wykonuje runner inline - jedna sciezka kodu.
