---
name: write-plan
description: Pisanie planu w docs/plans przed większą pracą (cel, kontekst, decyzje, kroki z kryteriami, ryzyka, poza zakresem). Użyj przy "zaplanuj", "napisz plan", "rozpisz zadanie", "plan implementacji" oraz przed zmianą dotykającą kilku paczek lub aplikacji.
---

# Plan implementacji (`docs/plans/<slug>.md`)

Plan piszesz **przed** większą pracą (wiele kroków, kilka paczek/aplikacji, ryzyko migracji, wiele sesji).
Drobne poprawki nie potrzebują planu. Katalog `docs/plans` utwórz, jeśli go brak. `<slug>` = kebab-case,
po polsku lub angielsku jak reszta repo (`powiadomienia-email`).

## Szablon

```md
# Plan: <tytuł>

Status: szkic | w toku | zakończony · Data: RRRR-MM-DD

## Cel

Jedno–trzy zdania: co ma być prawdą po zakończeniu i po co.

## Kontekst

Stan obecny, istotne pliki i ścieżki (`apps/server/src/...`), ograniczenia, powiązane ADR-y.

## Decyzje

Co już rozstrzygnięto i dlaczego (krótko). Otwarte pytania oznacz **Do ustalenia**.
Decyzja o wadze architektonicznej → osobny ADR (skill `write-adr`), tu tylko link.

## Kroki

- [ ] 1. Kontrakt w `packages/contracts/src/x.ts`
  - Kryterium: `bun check:types` przechodzi, schemat ma test.
- [ ] 2. Tabela i migracja (skill `db-change`)
  - Kryterium: `bun db:check` czyste.
- [ ] 3. ...

## Ryzyka

Co może pójść źle i jak to wykryjemy lub zredukujemy (migracje, kompatybilność, wydajność).

## Poza zakresem

Czego świadomie nie robimy w tym planie.
```

## Zasady

- Każdy krok jest **małym, weryfikowalnym** kawałkiem z kryterium akceptacji (komenda lub obserwowalny efekt),
  w kolejności zależności (kontrakt → db → repo → serwis → moduł → web).
- Odwołuj się do realnych ścieżek; sprawdź je w repo zamiast zgadywać.
- Plan to źródło prawdy o **zamiarze**; dziennik (`docs/progress`, skill `progress-log`) odhacza kroki i zapisuje
  hashe commitów – nie duplikuj listy zadań. Zmieniasz kierunek? Zaktualizuj plan i wpisz to w dzienniku.
- Po ukończeniu ustaw `Status: zakończony`; nie usuwaj planu (to historia decyzji).
- Pokaż plan użytkownikowi do akceptacji, zanim zaczniesz większą implementację, jeśli zakres jest niejasny.
