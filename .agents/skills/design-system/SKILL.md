---
name: design-system
description: Tokeny designu i komponenty UI w apps/web - gdzie żyją tokeny (kolory, typografia, promienie, cienie, odstępy, ruch), jak dodać token albo komponent, jak zmienić motyw i jak wybrać kierunek stylu. Użyj przy "dodaj token", "zmień kolor", "ciemny motyw", "nowy komponent ui", "design system", "styl projektu", "paleta", "typografia", "animacja w UI".
---

# Design system (`apps/web`)

**Najpierw przeczytaj `apps/web/AGENTS.md` (sekcja „Tokeny i design system”) i ADR 0007** (`docs/architecture/decisions/0007-design-tokens.md`).
Ten skill to przepis; reguły są w `AGENTS.md`.

## Gdzie co leży

- **Tokeny: wyłącznie `apps/web/src/styles/app.css`** (jedno źródło). Trzy warstwy:
  1. `:root` – kolory jako `light-dark(strona, ciemny panel)`, `--radius`;
  2. `@theme inline` – mapowanie kolorów i promieni na utility (`bg-primary`, `rounded-lg`);
  3. `@theme static` – typografia (`--text-*`), odstępy (`--spacing-gutter|section`, `--container-page`), cienie
     (`--shadow-*`), ruch (`--duration-*`, `--ease-*`); zawsze emitowane jako zmienne CSS.
- **Motyw:** tylko jasny (ADR 0012): `:root` ma `color-scheme: light`, bez reagowania na ciemny tryb systemu, bez
  przełącznika i ciasteczka. Ciemne wartości par `light-dark()` działają tylko w ciemnym panelu (`surface-panel`).
- **Komponenty:** prymitywy w `components/ui/<nazwa>/`, złożone bez wiedzy o featurach w `components/shared/<nazwa>/`
  (folder na komponent: `<nazwa>.tsx`, test, `index.ts`).
- **Katalog wizualny:** nie ma (trasę `/design` usunięto 2026-11-22 na prośbę właściciela) – zmianę oglądasz na
  stronach aplikacji, a stany komponentów (warianty, disabled, loading, error, empty) sprawdzają ich testy.

## Dodanie tokenu koloru

1. `app.css`: `--nazwa` i `--nazwa-foreground` w `:root` jako `light-dark(...)` (kontrast pary min. 4.5:1);
2. ten sam plik: `--color-nazwa: var(--nazwa)` w `@theme inline` (i `-foreground`);
3. dopisz token do listy w `src/test/design-tokens.test.ts`;
4. uruchom `bun test:e2e` (a11y sprawdza kontrast, wizualne pokaże zmianę – zaktualizuj baseline świadomie).

Token typografii, cienia, odstępu lub ruchu: dodaj do `@theme static`.

## Dodanie komponentu

1. Skopiuj najbliższy wzór (`components/ui/button`, `components/shared/empty-state`); styl tylko klasami z tokenów.
2. **Zero surowych kolorów:** bez hex/rgb/`bg-red-500`/`text-white`; strażnik `src/test/design-tokens.test.ts` to wymusza.
   Cień karty to `shadow-card`, a nie własny box-shadow; czas i krzywa z `duration-(--duration-base)`, `ease-out`.
3. Teksty z use-intl (`useTranslations`), nie literały; stany: ładowanie, błąd, pusty, wyłączony.
4. Dopisz test jednostkowy obok komponentu (stany: domyślny, wyłączony, błąd).

## Kierunek stylu (jeden na projekt)

Projekt ma kierunek „jasna powłoka z ciemnym panelem” (biel i grafit, panel `surface-panel` `#121814`, mięta
`--accent` tylko jako wypełnienie, krój Geist, kolory danych `--data-*`; ADR 0012, wcześniej „polowy” z ADR 0009). **Zmiana kierunku to decyzja: zapisz ją w ADR**
(`write-adr`). Nowy styl
**mapuj na tokeny** (kolory, fonty, promienie, cienie w `app.css`), nie na klasy rozsypane po komponentach.
Zasady repo (`AGENTS.md`, brak surowych kolorów) są ważniejsze niż zakazy i nakazy zewnętrznych wytycznych stylu.

## Ruch

Animacje mają być krótkie i celowe. Czasy i krzywe bierz z
tokenów `--duration-*`/`--ease-*`; `prefers-reduced-motion` obsługuje `app.css` (czasy spadają do ~0), więc nie
pisz własnych wyjątków. Animuj `transform` i `opacity`.

## Po zmianie

1. Obejrzyj zmianę na stronach aplikacji (strona główna, mapa, raport, ekran liczenia z ciemnym panelem).
2. `bun run --cwd apps/web test:e2e` – `e2e/a11y.spec.ts` (axe WCAG A/AA, przy systemie w trybie ciemnym) i zrzuty `@visual`, jeśli
   projekt je ma. Zmiana zamierzona → `bun run --cwd apps/web test:e2e -- --update-snapshots` i commit baseline.
3. `bun format && bun check`.
