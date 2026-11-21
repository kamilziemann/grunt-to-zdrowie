# Walidacja silnika na komunikatach i wykazach IUNG

Porównanie naszego wyniku z suszą rolniczą ogłoszoną przez IUNG (System Monitoringu Suszy Rolniczej) dla znanych
gmin i regionów. Skrypt: `apps/server/scripts/validate-iung.ts` (`bun run validate:iung -- --api <adres API>
[--json wynik.json]`), silnik `0.4.0`, uruchomienie 21.11.2026 na lokalnym API z prawdziwymi źródłami (NASA POWER,
SoilGrids, Terrain Tiles, BDOT10k, Sentinel-2). Przypadki suszy i odnośniki:
[`docs/research/2026-11-21-metodyka-uprawy-walidacja.md`](research/2026-11-21-metodyka-uprawy-walidacja.md),
sekcja 5. Przypadki „brak suszy” (runda 4) pochodzą z **wykazów gmin IUNG**
(`https://susza.iung.pulawy.pl/wykazy/<rok>,<TERYT gminy>/`, lata 2020–2025): tabela „+ / - / x” dla każdej
kategorii gleby I–IV, okresu i uprawy oraz udział powierzchni zagrożonej suszą. Wybraliśmy okresy, w których
w danej gminie kryterium nie było przekroczone na żadnej kategorii (0% powierzchni), w tych samych gminach,
uprawach i porach roku co przypadki suszy; część z nich to okresy, gdy susza była w innych częściach kraju (np.
20.06.2021: 628 gmin z suszą w zbożach ozimych, Obrowo i Pniewy bez).

## Jak liczymy

- Pole: prostokąt ok. 270 × 220 m (ok. 6 ha) od punktu w gminie. W rundzie 4 punkty w Ludwinie, Pniewach, Nowym
  Tomyślu i Dobrzeniu Wielkim przesunęliśmy z centrum miejscowości na najbliższy grunt orny (≥ 80% powierzchni
  działek w prostokącie to R wg ewidencji), żeby gleba i klasoużytki dotyczyły pola. W pozostałych pięciu gminach (Sicienko, Obrowo, Zielona Góra, Krokowa, Łask)
  ewidencja w usłudze zbiorczej nie podaje klasoużytków (niżej), więc punkty zostały.
- **Zgodność KBW**: nasz werdykt KBW dla kategorii gleby pola vs ogłoszenie IUNG dla gminy.
- **Zgodność poziomu**: IUNG „susza” ↔ nasz alarm (`drought` albo `risk`); IUNG „brak” ↔ brak alarmu (`ok`,
  `watch`, `excess`). „Obserwuj” (`watch`) nie jest ogłoszeniem suszy, ale liczymy je osobno, bo rolnik widzi
  ostrzeżenie.
- **Kategorie zgodne z wykazem gminy**: dla przypadków z wykazem (od 2020 r.) porównujemy nasz werdykt dla każdej
  z czterech kategorii („pod progiem kat. I–IV”) z „+ / -” IUNG — to sprawdza sam rachunek KBW, niezależnie od
  tego, jaką kategorię gleby przypiszemy polu.

## Wyniki (po zmianach, silnik 0.4.0)

| Miejsce, data                                    | Uprawa        | IUNG  | IUNG kat. I/II/III/IV | KBW / próg (kat., okres)               | Pod progiem kat. I/II/III/IV | Poziom / pewność | Zgodność KBW | Zgodność poziomu |
| ------------------------------------------------ | ------------- | ----- | --------------------- | -------------------------------------- | ---------------------------- | ---------------- | ------------ | ---------------- |
| Sicienko (kujawsko-pomorskie), 2023-05-20        | spring_barley | brak  | -/-/-/-               | -46.7 / -125 (kat. 1 z 1–3, okres 1)   | nie/nie/nie/nie              | ok / medium      | ✓            | ✓                |
| Ludwin (lubelskie), 2023-05-20                   | spring_barley | brak  | -/-/-/-               | 34.9 / -194 (kat. 4 z 4–4, okres 1)    | nie/nie/nie/nie              | ok / medium      | ✓            | ✓                |
| Sicienko (kujawsko-pomorskie), 2023-06-20        | spring_barley | susza | +/+/+/+               | -191.1 / -135 (kat. 1 z 1–3, okres 4)  | tak/tak/tak/nie              | drought / medium | ✓            | ✓                |
| Obrowo (kujawsko-pomorskie), 2023-06-20          | spring_barley | susza | +/+/+/+               | -196.7 / -154 (kat. 2 z 2–3, okres 4)  | tak/tak/tak/nie              | drought / medium | ✓            | ✓                |
| Zielona Góra (lubuskie), 2022-07-31              | maize_grain   | susza | +/+/+/-               | -169.6 / -184 (kat. 2 z 2–3, okres 8)  | tak/nie/nie/nie              | risk / low       | ✗            | ✓                |
| Pojezierze Poznańskie (Pniewy), 2018-07-10       | winter_wheat  | susza | –                     | -200.7 / -165 (kat. 1 z 1–3, okres 6)  | tak/tak/nie/nie              | drought / low    | ✓            | ✓                |
| Wysoczyzna Żarnowiecka (Krokowa), 2018-07-10     | winter_wheat  | susza | –                     | -255.3 / -186 (kat. 2 z 2–3, okres 6)  | tak/tak/tak/tak              | drought / medium | ✓            | ✓                |
| zachodnia Wielkopolska (Nowy Tomyśl), 2019-07-31 | maize_grain   | susza | –                     | -187.3 / -152 (kat. 1 z 1–3, okres 8)  | tak/tak/nie/nie              | drought / low    | ✓            | ✓                |
| Wysoczyzna Łaska (Łask), 2019-07-31              | maize_grain   | susza | –                     | -212 / -184 (kat. 2 z 2–3, okres 8)    | tak/tak/nie/nie              | drought / low    | ✓            | ✓                |
| Równina Opolska (Dobrzeń Wielki), 2019-07-31     | maize_grain   | susza | –                     | -206.8 / -184 (kat. 2 z 2–4, okres 8)  | tak/tak/nie/nie              | drought / low    | ✓            | ✓                |
| Zielona Góra (lubuskie), 2021-06-30              | winter_wheat  | brak  | -/-/-/-               | -52.2 / -175 (kat. 2 z 2–3, okres 5)   | nie/nie/nie/nie              | watch / low      | ✓            | ✓                |
| Zielona Góra (lubuskie), 2023-05-31              | spring_barley | brak  | -/-/-/-               | -75.7 / -146 (kat. 2 z 2–3, okres 2)   | nie/nie/nie/nie              | watch / low      | ✓            | ✓                |
| Obrowo (kujawsko-pomorskie), 2021-06-20          | winter_wheat  | brak  | -/-/-/-               | -82.4 / -166 (kat. 2 z 2–3, okres 4)   | nie/nie/nie/nie              | watch / medium   | ✓            | ✓                |
| Sicienko (kujawsko-pomorskie), 2020-08-20        | maize_grain   | brak  | -/-/-/-               | -110.2 / -154 (kat. 1 z 1–3, okres 10) | nie/nie/nie/nie              | watch / medium   | ✓            | ✓                |
| Sicienko (kujawsko-pomorskie), 2025-06-20        | spring_barley | brak  | -/-/-/-               | -113.6 / -135 (kat. 1 z 1–3, okres 4)  | nie/nie/nie/nie              | watch / medium   | ✓            | ✓                |
| Nowy Tomyśl (wielkopolskie), 2021-06-20          | spring_barley | brak  | -/-/-/-               | -112.3 / -135 (kat. 1 z 1–3, okres 4)  | nie/nie/nie/nie              | watch / medium   | ✓            | ✓                |
| Pniewy (wielkopolskie), 2021-06-20               | winter_wheat  | brak  | -/-/-/-               | -113.3 / -145 (kat. 1 z 1–3, okres 4)  | nie/nie/nie/nie              | watch / medium   | ✓            | ✓                |
| Krokowa (pomorskie), 2025-06-20                  | winter_wheat  | brak  | -/-/-/-               | -128.2 / -166 (kat. 2 z 2–3, okres 4)  | nie/nie/nie/nie              | watch / medium   | ✓            | ✓                |
| Łask (łódzkie), 2024-08-20                       | maize_grain   | brak  | -/-/-/-               | -60.9 / -186 (kat. 2 z 2–3, okres 10)  | nie/nie/nie/nie              | watch / low      | ✓            | ✓                |
| Dobrzeń Wielki (opolskie), 2023-05-31            | spring_barley | brak  | -/-/-/-               | -49.1 / -146 (kat. 2 z 2–4, okres 2)   | nie/nie/nie/nie              | ok / medium      | ✓            | ✓                |
| Ludwin (lubelskie), 2023-05-31                   | winter_wheat  | brak  | -/-/-/-               | -27.3 / -218 (kat. 4 z 4–4, okres 2)   | nie/nie/nie/nie              | ok / medium      | ✓            | ✓                |

## Przed i po

| Miara                                        | Runda 3 (10 przyp.) | Przed zmianą (21 przyp.) | Lżejsza kategoria | + poziom z niedoboru ET (0.4.0) |
| -------------------------------------------- | ------------------- | ------------------------ | ----------------- | ------------------------------- |
| Zgodność KBW, susza                          | 3/8                 | 3/8                      | **7/8**           | 7/8                             |
| Zgodność KBW, brak suszy                     | 2/2                 | 13/13                    | 13/13             | 13/13                           |
| Alarm przy suszy (`drought`/`risk`)          | 8/8                 | 8/8                      | 8/8               | 8/8                             |
| Brak alarmu przy braku suszy                 | 2/2                 | **6/13**                 | 6/13              | **13/13**                       |
| „Obserwuj” przy braku suszy                  | 0/2                 | 2/13                     | 2/13              | 9/13                            |
| Kategorie zgodne z wykazem gminy (16 przyp.) | –                   | 60/64                    | 60/64             | 60/64                           |

„Przed zmianą” = silnik 0.3.0 na nowym zestawie (z przesuniętymi punktami); wynik dla 10 przypadków z rundy 3 się
nie zmienił.

## Wybór reguły kategorii gleby

Rozważone reguły (zlecenie rundy 4) na 21 przypadkach:

- **(a) lżejszy koniec `categoryRange`** (mniejsza z kategorii z uziarnienia i z wody w profilu): KBW przy suszy
  3/8 → **7/8**, bez fałszywego alarmu KBW (w 13/13 przypadkach „brak” żadna kategoria nie jest pod progiem — nasz KBW
  w tych okresach jest daleko od progów nawet dla kat. I).
- **(b) kategoria z wody w profilu** (granice WOD IUNG 127,5 / 170 / 202,5 mm do 1,5 m): w każdym z 9 miejsc woda
  wskazała kategorię lżejszą albo równą uziarnieniu, więc (b) daje tu ten sam wynik co (a). Różniłaby się tylko
  tam, gdzie woda wskazuje cięższą kategorię niż uziarnienie — takiego przypadku w zestawie nie ma, więc (b) nie da
  się odróżnić od (a) na danych.
- **(c) klasa bonitacyjna z ewidencji**: IUNG nie publikuje przypisania klas do kategorii — kategorie wynikają
  wyłącznie z uziarnienia z mapy glebowo-rolniczej (`susza.iung.pulawy.pl/kategorie/`). Rozporządzenie
  o gleboznawczej klasyfikacji gruntów (Dz.U. 2012 poz. 1246) opisuje klasy V–VI głównie jako piaski słabogliniaste
  i luźne („gleby zbyt lekkie, za suche”), ale **do tych samych klas zalicza gleby zbyt mokre, glejowe, płytkie
  i kamieniste**, a klasy IIIb–IVb łączą piaski gliniaste mocne z ciężkimi glinami. Klasa mówi o przydatności
  rolniczej, nie o uziarnieniu. Do tego usługa zbiorcza WFS nie podaje klasoużytków w części powiatów (bydgoski,
  toruński, zielonogórski, pucki, łaski — puste `KLASOUZYTKI_EGIB`), a sygnał „same klasy V–VI” wystąpił
  w zestawie raz (Nowy Tomyśl: V, VI — tam (a) już daje kat. I). Reguły (c) nie dało się więc zweryfikować;
  klasy pokazujemy jako dowód w raporcie (`registry_soil_class`), nie zmieniają kategorii.

**Wybrana reguła: (a).** Kategoria do progu = lżejszy koniec zakresu, zakres zostaje w raporcie
(`assessment.soilCategoryRange`) i obniża pewność, gdy sąsiednia kategoria zmienia werdykt.

**Uczciwe zastrzeżenie.** Wykazy gmin pokazują, że nasz KBW jest nieco łagodniejszy niż IUNG: 4 z 64 werdyktów
per kategoria się różnią i we wszystkich czterech IUNG ma suszę, a my nie (kat. IV w Sicienku i Obrowie 20.06.2023,
kat. II–III w Zielonej Górze 31.07.2022). Lżejsza kategoria częściowo kompensuje tę różnicę (siatka NASA POWER
0,5° × 0,625° rozmywa lokalne niedobory opadu). Na 13 przypadkach bez suszy nie wywołała fałszywego alarmu, ale
przy danych stacyjnych (IMGW, AgERA5) regułę trzeba sprawdzić ponownie.

## Poziom oceny: fałszywe alarmy z bilansu strefy korzeniowej

Nowe przypadki „brak suszy” pokazały problem, którego 2 przypadki z rundy 3 nie ujawniły: **7 z 13** dostawało
`risk`, bo poziom przechodził na „ryzyko” przy jakimkolwiek stresie w strefie korzeni (Ks < 1 w dniu analizy),
nawet po kilku dniach. Kryterium IUNG to spadek plonu o 20% w okresie 6 dekad. Poziom `risk` z bilansu wymaga
teraz **niedoboru ewapotranspiracji uprawy ≥ 20% w 60 dniach do daty analizy** (`1 − ΣETa/ΣETc`, przy Ky ≈ 1 wg
FAO-33 to ok. 20% plonu; nowe pole `rootZone.etDeficitShare60d`); krótszy stres daje `watch`. Próg 20% wynika
z kryterium IUNG, nie z dopasowania do zestawu: w przypadkach suszy udział wynosi 0,18–0,62, w przypadkach bez
suszy 0–0,18 (Nowy Tomyśl i Pniewy 20.06.2021: 0,18 — blisko progu, więc `watch`).

Skutek: 13/13 bez alarmu przy braku suszy (było 6/13), alarm nadal w 8/8 przypadkach suszy. 9 z 13 przypadków bez
suszy pokazuje „obserwuj” — to okresy z wyraźnym ubytkiem wody w strefie korzeni (KBW −50…−130 mm), więc
ostrzeżenie jest uzasadnione, ale nie jest ogłoszeniem suszy.

## Rozbieżności i ich przyczyny

1. **Zielona Góra, 31.07.2022, kukurydza**: KBW −170 mm przy progu kat. II −184 mm (IUNG: susza na kat. I–III).
   Pole ma glebę zastępczą (w prostokącie brak predykcji SoilGrids), a siatka NASA POWER uśrednia opad z ok.
   55 × 43 km. Poziom i tak alarmuje (`risk`: niedobór ET 28% w 60 dniach).
2. **Siatka NASA POWER** — IUNG liczy KBW z interpolacji stacji IMGW; różnica kilkunastu–kilkudziesięciu mm na
   okres jest możliwa.
3. **Punkt, nie gmina.** Jedno pole ok. 6 ha vs cała gmina; IUNG ogłasza suszę, gdy wystąpiła na którejkolwiek
   kategorii w gminie.
4. **Dobór uprawy dla „silnych epizodów” 2018 i 2019** (Doroszewski i Koza) jest nasz; wykazów gmin sprzed 2020 r.
   IUNG nie publikuje w tej formie.

## Czego ta walidacja nie pokazuje

- Kategorii gleby pola nie porównaliśmy z mapą glebowo-rolniczą (WMS IUNG/GUGiK) — tylko z udziałami kategorii
  w gminie, które da się oszacować z wykazów (np. Sicienko: ok. 10% kat. I, 59% II, 29% III; Nowy Tomyśl: 36% I,
  63% II). SoilGrids daje z uziarnienia kat. III albo IV we wszystkich 9 miejscach; lżejszy koniec zakresu daje I–II w 8
  z 9, co jest bliższe tym udziałom.
- 21 przypadków to nadal mało: reguła poziomu i kategorii może wymagać korekty na innych regionach (góry, Żuławy).
