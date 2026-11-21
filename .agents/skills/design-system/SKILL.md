---
name: design-system
description: Tokeny designu i komponenty UI w apps/web - gdzie żyją tokeny (kolory, typografia, promienie, cienie, odstępy, ruch), jak dodać token albo komponent, jak zmienić motyw i jak wybrać kierunek stylu. Użyj przy "dodaj token", "zmień kolor", "ciemny motyw", "nowy komponent ui", "design system", "strona /design", "styl projektu", "paleta", "typografia", "animacja w UI".
---

# Design system (`apps/web`)

**Najpierw przeczytaj `apps/web/AGENTS.md` (sekcja „Tokeny i design system”) i ADR 0007** (`docs/architecture/decisions/0007-design-tokens.md`).
Ten skill to przepis; reguły są w `AGENTS.md`.

## Gdzie co leży

- **Tokeny: wyłącznie `apps/web/src/styles/app.css`** (jedno źródło). Trzy warstwy:
  1. `:root` – kolory jako `light-dark(jasny, ciemny)` (jedno miejsce na oba motywy), `--radius`;
  2. `@theme inline` – mapowanie kolorów i promieni na utility (`bg-primary`, `rounded-lg`);
  3. `@theme static` – typografia (`--text-*`), odstępy (`--spacing-gutter|section`, `--container-page`), cienie
     (`--shadow-*`), ruch (`--duration-*`, `--ease-*`); zawsze emitowane jako zmienne CSS.
- **Motyw:** bez `data-theme` obowiązuje system (`prefers-color-scheme`); `data-theme="light|dark"` (lub klasa
  `.light`/`.dark`) wymusza motyw. Serwer ustawia atrybut z ciasteczka `theme` (`lib/theme`, `providers/theme-provider`),
  więc nie ma mignięcia. Przełącznik: `components/shared/theme-toggle`.
- **Komponenty:** prymitywy w `components/ui/<nazwa>/`, złożone bez wiedzy o featurach w `components/shared/<nazwa>/`
  (folder na komponent: `<nazwa>.tsx`, test, `index.ts`).
- **Katalog wizualny:** trasa `/design` (`src/routes/{-$locale}/_app/_dev/design.tsx`, tylko development) – tokeny i każdy komponent ui/shared we
  wszystkich stanach (warianty, disabled, loading, error, empty). To także cel testów wizualnych.

## Dodanie tokenu koloru

1. `app.css`: `--nazwa` i `--nazwa-foreground` w `:root` jako `light-dark(...)` (kontrast pary min. 4.5:1);
2. ten sam plik: `--color-nazwa: var(--nazwa)` w `@theme inline` (i `-foreground`);
3. dopisz próbkę do `COLOR_TOKENS` w `/design` i token do listy w `src/test/design-tokens.test.ts`;
4. uruchom `bun test:e2e` (a11y sprawdza kontrast, wizualne pokaże zmianę – zaktualizuj baseline świadomie).

Token typografii, cienia, odstępu lub ruchu: dodaj do `@theme static` i do odpowiedniej sekcji `/design`.

## Dodanie komponentu

1. Skopiuj najbliższy wzór (`components/ui/button`, `components/shared/empty-state`); styl tylko klasami z tokenów.
2. **Zero surowych kolorów:** bez hex/rgb/`bg-red-500`/`text-white`; strażnik `src/test/design-tokens.test.ts` to wymusza.
   Cień karty to `shadow-card`, a nie własny box-shadow; czas i krzywa z `duration-(--duration-base)`, `ease-out`.
3. Teksty z use-intl (`useTranslations`), nie literały; stany: ładowanie, błąd, pusty, wyłączony.
4. Dopisz komponent do `/design` we wszystkich stanach i test jednostkowy obok.

## Kierunek stylu (jeden na projekt)

Projekt ma kierunek „polowy” (zieleń pola + błękit wody, ADR 0009). **Zmiana kierunku to decyzja: zapisz ją w ADR**
(`write-adr`), potem wybierz **jeden** ze skilli stylu: `design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`,
`industrial-brutalist-ui` (wykluczają się; pozostałe usuń razem z symlinkiem w `.claude/skills`). Wybrany styl
**mapuj na tokeny** (kolory, fonty, promienie, cienie w `app.css`), nie na klasy rozsypane po komponentach.
Zasady repo (`AGENTS.md`, brak surowych kolorów) są ważniejsze niż zakazy i nakazy skilla stylu.

## Ruch

Animacje projektuj skillami Emila Kowalskiego: `animate` (czy, po co, czym, krzywa, czas), `emil-design-eng`
(dopracowanie), `animation-performance` (budżet klatki), `review-animations` (przegląd kodu). Czasy i krzywe bierz z
tokenów `--duration-*`/`--ease-*`; `prefers-reduced-motion` obsługuje `app.css` (czasy spadają do ~0), więc nie
pisz własnych wyjątków. Animuj `transform` i `opacity`.

## Po zmianie

1. Otwórz `/design` w jasnym i ciemnym motywie (przełącznik w nawigacji) i obejrzyj zmianę.
2. `bun run --cwd apps/web test:e2e` – `e2e/a11y.spec.ts` (axe WCAG A/AA, jasny i ciemny) i zrzuty `@visual`, jeśli
   projekt je ma. Zmiana zamierzona → `bun run --cwd apps/web test:e2e -- --update-snapshots` i commit baseline.
3. `bun format && bun check`.
