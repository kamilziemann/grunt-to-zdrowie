# Raporty wzorcowe

Trzy raporty wodne wydrukowane do PDF tak, jak robi to przycisk „Zapisz PDF” w aplikacji (Chrome, A4), z prawdziwego
API (silnik 0.8.0 „Pogodynka wody”, 22.11.2026). Strona 1 to widok prosty jako infografika (werdykt na skali, zbiornik
wody, 10 lat, przyczyny, pierwszy krok, szkic pola), strona 2 – woda teraz (zbiornik, odliczanie, rachunek wody), 10 lat
i co robić, dalej pełna analiza (liczby z odniesieniem, deszcz dzień po dniu, satelita, „Pole z satelity” – obrazy
działki „Kondycja roślin” i „Woda w roślinach” z dnia analizy, kalendarz suszy, przyczyny
z udziałem, miejsca na polu, zalecenia, nawadnianie, źródła) i miejsce na notatki doradcy. Na każdej stronie nagłówek
(pełny numer działki, dzień analizy, identyfikator raportu) i stopka (krótki link do raportu, źródła, numer strony).

| Plik                                    | Działka, uprawa, dzień                                 | Co pokazuje                                                      |
| --------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| `raport-susza-row-przez-pole-349-1.pdf` | `080904_5.0001.349/1` (Chwalim), pszenica, 15.06.2018  | bardzo sucho, 33 dni stresu, rów przez pole, 4 miejsca, zastawka |
| `raport-nadmiar-wody-laka-39-2.pdf`     | `141507_2.0010.39/2` (Łyse), łąka, 20.09.2017          | mokro, zbiornik 99%, zagłębienia bez odpływu z pojemnością       |
| `raport-susza-slaba-gleba-254.pdf`      | `141507_2.0019.254` (Wejdo), jęczmień jary, 20.06.2023 | bardzo sucho na słabej glebie (klasa VI), 1 miejsce na polu      |

Nowe pliki: serwer dev z prawdziwymi źródłami (`bun run --cwd apps/web dev -- --port 3310`), potem
`bun run --cwd apps/web samples:pdf`. Skrypt woła prawdziwe usługi (GUGiK ma nocny limit zapytań) — nie uruchamiaj go
seryjnie. W nagłówku i stopce jest adres wdrożenia (`SAMPLES_PUBLIC_URL`, domyślnie
`https://grunt-to-zdrowie.hoxu.workers.dev`), choć treść podaje serwer lokalny; `SAMPLES_API_URL` kieruje `/api` na inny
serwer. Te pliki (runda 9): strony z gałęzi raportu (`claude-jakub`, z sekcją „Pole z satelity”, której wdrożenie
jeszcze nie ma), a całe `/api` – dane raportu, rowy, zdjęcia z satelity – z serwera wdrożonego
(`SAMPLES_API_URL=https://grunt-to-zdrowie.hoxu.workers.dev`).
