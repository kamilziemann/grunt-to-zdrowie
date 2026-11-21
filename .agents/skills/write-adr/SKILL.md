---
name: write-adr
description: Zapisuje decyzję architektoniczną jako ADR w docs/architecture/decisions. Użyj przy "napisz ADR", "zapisz decyzję", "dlaczego wybraliśmy", albo gdy wybierasz bibliotekę, wzorzec, zmieniasz granice architektury lub odstępujesz od istniejącej decyzji.
---

# ADR (Architecture Decision Record)

Pliki: `docs/architecture/decisions/NNNN-<slug>.md`, po polsku. `NNNN` = kolejny numer (sprawdź
`ls docs/architecture/decisions`, bierz najwyższy + 1, cztery cyfry), `<slug>` = kebab-case angielski
(wzór: `0001-d1-instead-of-postgres.md`, `0002-optional-auth.md`).

## Kiedy pisać

- Wybór technologii/biblioteki lub zmiana wersji z konsekwencjami (np. TypeScript 5.9, Vitest 4).
- Zmiana granic architektury (nowa warstwa, nowa paczka, nowy wyjątek w `architecture.config.ts`).
- Świadome odroczenie lub odrzucenie czegoś ("na razie bez auth").
- Odejście od wcześniejszego ADR (stary oznacz `Status: zastąpione przez NNNN`, nie kasuj).
- Nie pisz ADR dla zwykłej funkcji ani refaktoru bez zmiany zasad – wystarczy commit/dziennik.

## Format (dokładnie)

```md
# ADR NNNN: Tytuł

Status: przyjęte · Data: RRRR-MM

## Kontekst

Problem, ograniczenia, rozważane opcje (1–3 akapity lub lista).

## Decyzja

Co robimy, konkretnie (nazwy paczek, ścieżek, komend). Jeśli zmienia reguły, wskaż plik konfiguracji.

## Konsekwencje

- Co zyskujemy, co kosztuje, co staje się łatwiejsze/trudniejsze.
- Kiedy wrócimy do decyzji (warunek rewizji).
```

Dozwolone statusy: `przyjęte`, `zaproponowane`, `zastąpione przez NNNN`, `odrzucone`.

## Po napisaniu

1. Jeśli ADR zmienia regułę, najpierw zmień konfigurację (`architecture.config.ts`, `.oxlintrc.json`, ...), potem
   `AGENTS.md` (opis słowami), na końcu ADR.
2. Odnotuj ADR w dzienniku postępu (skill `progress-log`) i w planie, jeśli powstał z planu.
3. `bun format` (oxfmt formatuje też Markdown), potem skill `verify-change`.
