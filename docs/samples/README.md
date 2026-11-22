# Raporty wzorcowe

Trzy raporty wodne wydrukowane do PDF tak, jak robi to przycisk „Zapisz PDF” w aplikacji (Chrome, A4), z prawdziwego
API (silnik 0.8.5, 22.11.2026). Strona 1 to pierwsza część raportu jako infografika (werdykt na skali, zbiornik
wody, 10 lat, przyczyny, pierwszy krok, szkic pola), strona 2 – woda teraz (zbiornik, odliczanie, rachunek wody), 10 lat
i co robić, dalej pełna analiza (liczby z odniesieniem, deszcz dzień po dniu, satelita, „Pole z satelity” – obrazy
działki „Kondycja roślin” i „Woda w roślinach” z dnia analizy, kalendarz suszy, przyczyny
z udziałem, miejsca na polu, zalecenia, nawadnianie, źródła) i miejsce na notatki doradcy. Na każdej stronie nagłówek
(pełny numer działki, dzień analizy, identyfikator raportu) i stopka (krótki link do raportu, źródła, numer strony).

| Plik                                    | Działka, uprawa, dzień                                 | Co pokazuje                                                               |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `raport-susza-row-przez-pole-349-1.pdf` | `080904_5.0001.349/1` (Chwalim), pszenica, 15.06.2018  | bardzo sucho, seria dni stresu, rów przez pole, miejsca na polu, zastawka |
| `raport-nadmiar-wody-laka-39-2.pdf`     | `141507_2.0010.39/2` (Łyse), łąka, 20.09.2017          | mokro, zbiornik 99%, zagłębienia bez odpływu z pojemnością                |
| `raport-susza-slaba-gleba-254.pdf`      | `141507_2.0019.254` (Wejdo), jęczmień jary, 20.06.2023 | bardzo sucho na słabej glebie (klasa VI), 1 miejsce na polu               |

Nowe pliki: serwer dev z prawdziwymi źródłami (np. działający `bun run --cwd apps/web dev`), potem
`SAMPLES_BASE_URL=http://localhost:3000 bun run --cwd apps/web samples:pdf`. Skrypt klika „Drukuj / zapisz PDF” jak
rolnik (przycisk sam pobiera zdjęcia z satelity) i zapisuje stronę, gdy aplikacja otworzyłaby okno wydruku. Woła
prawdziwe usługi (GUGiK ma nocny limit zapytań) — nie uruchamiaj go seryjnie. W nagłówku i stopce jest adres wdrożenia
(`SAMPLES_PUBLIC_URL`, domyślnie `https://grunt-to-zdrowie.hoxu.workers.dev`), choć treść podaje serwer lokalny;
`SAMPLES_API_URL` kieruje `/api` na inny serwer. Te pliki: strony i API z lokalnego serwera na `main` (silnik 0.8.5,
ten sam kod co wdrożenie z 22.11.2026).
