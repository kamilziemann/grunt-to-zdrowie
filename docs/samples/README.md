# Raporty wzorcowe

Trzy raporty wodne wydrukowane do PDF tak, jak robi to przycisk „Drukuj / zapisz PDF” w aplikacji (Chrome, A4),
z prawdziwego API (silnik 0.5.0, 22.11.2026). Na każdej stronie jest nagłówek (pole, dzień analizy, identyfikator
raportu) i stopka (źródła danych, numer strony).

| Plik                                    | Działka, uprawa, dzień                                | Co pokazuje                                                |
| --------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `raport-susza-row-przez-pole-349-1.pdf` | `080904_5.0001.349/1` (Chwalim), pszenica, 15.06.2018 | susza, rów przez pole (428 m), 4 miejsca na polu, zastawka |
| `raport-nadmiar-wody-laka-39-2.pdf`     | `141507_2.0010.39/2` (Łyse), łąka, 20.09.2017         | nadmiar wody, dwa zagłębienia bez odpływu z pojemnością    |
| `raport-susza-slaba-gleba-254.pdf`      | `141507_2.0019.254` (Łyse), jęczmień jary, 20.06.2023 | susza na słabej glebie (klasa VI), plan podlewania         |

Nowe pliki: serwer dev z prawdziwymi źródłami (`bun run --cwd apps/web dev -- --port 3310`), potem
`bun run --cwd apps/web samples:pdf`. Skrypt woła prawdziwe usługi (GUGiK ma nocny limit zapytań) — nie uruchamiaj go
seryjnie. Adres w nagłówku pierwszej strony to adres serwera, z którego drukowano (tu `localhost:3310`).
