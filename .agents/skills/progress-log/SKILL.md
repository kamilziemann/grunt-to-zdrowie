---
name: progress-log
description: Prowadzenie dziennika postępu sesji w docs/progress. Użyj na początku większej pracy, po każdym commicie działającej zmiany oraz gdy użytkownik pyta o "dziennik", "progress", "stan prac" albo chce przekazać pracę innemu modelowi.
---

# Dziennik postępu (`docs/progress`)

Zasady źródłowe: `docs/progress/README.md` (i sekcja "Dziennik postępu" w `AGENTS.md`). Cel: inny model lub
osoba podejmuje pracę bez czytania rozmowy.

## Plik sesji

Ścieżka: `docs/progress/RRRR-MM-DD/<krotka-nazwa>-<id>.md`

- `RRRR-MM-DD` – dzisiejsza data; folder utwórz, jeśli nie istnieje.
- `<krotka-nazwa>` – kebab-case, co robi sesja (`mapa-dzialek`, `silnik-analizy`).
- `<id>` – unikalny dopisek: początek id sesji albo `openssl rand -hex 4`.
- Jedna sesja = jeden plik; kilka sesji tego dnia nie pisze do wspólnego pliku.

## Szablon

```md
# <Tytuł sesji>

## Stan teraz

1–5 linii, zawsze aktualne: co działa, co jest w toku, co zablokowane.

## Zrobione

- [abc1234] feat(server): krótki opis (co i dlaczego to ważne)

## Następny krok

Konkretnie, do wykonania bez kontekstu rozmowy: pliki, komendy, kryterium ukończenia.
```

## Kiedy aktualizować

- Po **każdym commicie** większej, działającej zmiany (i po merge'u): dopisz wpis w **Zrobione** z hashem
  (`git log -1 --format=%h`), odśwież **Stan teraz** i **Następny krok**.
- Przy zmianie kierunku, blokadzie albo decyzji, którą trzeba zapamiętać (większe decyzje → skill `write-adr`).
- Na końcu sesji: dziennik odpowiada rzeczywistemu stanowi repo (także to, czego nie zweryfikowano).

## Plany

Plan źródłowy żyje w `docs/plans/<slug>.md` (skill `write-plan`). Dziennik go **nie powtarza** – odhacza kroki
planu (`- [x]`) i linkuje do niego. Nie kopiuj list zadań do dwóch miejsc.

## Zasady

- Pisz po polsku, zwięźle, konkretnie; bez wklejania logów (wystarczy komenda i wynik w jednym zdaniu).
- Nie commituj dziennika osobno od pracy, której dotyczy, jeśli to ten sam commit; dopiski po hashu idą w
  kolejnym commicie `docs(docs): dziennik - ...`.
