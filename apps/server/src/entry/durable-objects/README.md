# entry/durable-objects

Miejsce na Durable Objects, gdy pojawi sie potrzeba koordynacji lub stanu w czasie rzeczywistym (WebSocket, blokada
"jeden proces naraz", licznik). Dzis brak.

Jak dodac:

1. `wrangler.jsonc`: `"durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] }`
   oraz `"migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]`.
2. Klasa w `src/entry/durable-objects/room.ts`; eksport z `src/index.ts`; binding w `ServerBindings`.
3. Logika domenowa zostaje w `services/`; DO tylko trzyma stan polaczen i deleguje.
