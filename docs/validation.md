# Walidacja silnika na komunikatach IUNG

Porównanie naszego wyniku z suszą rolniczą ogłoszoną przez IUNG (System Monitoringu Suszy Rolniczej) dla znanych
gmin i regionów. Skrypt: `apps/server/scripts/validate-iung.ts` (`bun run validate:iung -- --api <adres API>`),
silnik `0.3.0`, uruchomienie 21.11.2026 na lokalnym API z prawdziwymi źródłami (NASA POWER, SoilGrids, Terrain
Tiles, BDOT10k, Sentinel-2). Przypadki i odnośniki do komunikatów:
[`docs/research/2026-11-21-metodyka-uprawy-walidacja.md`](research/2026-11-21-metodyka-uprawy-walidacja.md),
sekcja 5.

## Jak liczymy

- Pole: prostokąt ok. 270 × 220 m (ok. 6 ha) od punktu w gminie albo regionie z komunikatu. Gleba z SoilGrids
  dla tego prostokąta, pogoda z komórki NASA POWER (0,5° × 0,625°).
- **Zgodność KBW**: nasz werdykt KBW dla kategorii gleby pola (z SoilGrids) vs komunikat IUNG.
- **Zgodność poziomu**: IUNG „susza” ↔ nasz poziom `drought`, `risk` albo `watch`; IUNG „brak” ↔ `ok` (albo
  `excess`).
- IUNG ogłasza suszę w gminie, gdy wystąpiła na glebach którejkolwiek kategorii obecnej w gminie (komunikat podaje
  udział powierzchni). Kolumna „pod progiem kat. I/II/III/IV” pokazuje więc nasz wynik dla każdej kategorii.

## Wyniki

| Miejsce, data                                | Uprawa         | IUNG  | KBW / próg (kat., okres)  | Pod progiem kat. I/II/III/IV | Poziom / pewność | Zgodność KBW | Zgodność poziomu |
| -------------------------------------------- | -------------- | ----- | ------------------------- | ---------------------------- | ---------------- | ------------ | ---------------- |
| Sicienko (kujawsko-pomorskie), 2023-05-20    | jęczmień jary  | brak  | −46,7 / −174 (kat. 3, 1)  | nie/nie/nie/nie              | ok / medium      | ✓            | ✓                |
| Ludwin (lubelskie), 2023-05-20               | jęczmień jary  | brak  | +34,9 / −194 (kat. 4, 1)  | nie/nie/nie/nie              | ok / medium      | ✓            | ✓                |
| Sicienko (kujawsko-pomorskie), 2023-06-20    | jęczmień jary  | susza | −191,1 / −184 (kat. 3, 4) | tak/tak/tak/nie              | drought / low    | ✓            | ✓                |
| Obrowo (kujawsko-pomorskie), 2023-06-20      | jęczmień jary  | susza | −196,7 / −184 (kat. 3, 4) | tak/tak/tak/nie              | drought / low    | ✓            | ✓                |
| Zielona Góra (lubuskie), 2022-07-31          | kukurydza      | susza | −169,6 / −220 (kat. 3, 8) | tak/nie/nie/nie              | risk / low       | ✗            | ✓                |
| Pojezierze Poznańskie (Pniewy), 2018-07-10   | pszenica ozima | susza | −200,8 / −224 (kat. 3, 6) | tak/tak/nie/nie              | risk / low       | ✗            | ✓                |
| Wysoczyzna Żarnowiecka (Krokowa), 2018-07-10 | pszenica ozima | susza | −255,3 / −224 (kat. 3, 6) | tak/tak/tak/tak              | drought / medium | ✓            | ✓                |
| zach. Wielkopolska (Nowy Tomyśl), 2019-07-31 | kukurydza      | susza | −187,4 / −220 (kat. 3, 8) | tak/tak/nie/nie              | risk / low       | ✗            | ✓                |
| Wysoczyzna Łaska (Łask), 2019-07-31          | kukurydza      | susza | −212,0 / −220 (kat. 3, 8) | tak/tak/nie/nie              | risk / low       | ✗            | ✓                |
| Równina Opolska (Dobrzeń Wielki), 2019-07-31 | kukurydza      | susza | −206,9 / −220 (kat. 3, 8) | tak/tak/nie/nie              | risk / low       | ✗            | ✓                |

**Zgodność poziomu: 10 z 10. Zgodność werdyktu KBW dla kategorii z SoilGrids: 5 z 10.** Jeśli liczyć jak IUNG
(susza na którejkolwiek kategorii), zgodność KBW to 10 z 10: w każdym przypadku suszy co najmniej kategoria I jest
pod progiem, a w obu przypadkach „brak” żadna.

## Rozbieżności i ich przyczyny

1. **Kategoria gleby z SoilGrids jest za ciężka.** We wszystkich pięciu rozbieżnościach KBW przekracza próg dla
   kat. I–II, a nie dla kat. III, którą SoilGrids daje polu. SoilGrids przypisał kat. III w 9 z 10 miejsc (Ludwin:
   IV), choć w Polsce przeważają gleby lekkie. To ta sama skłonność, którą widać na działce wzorcowej w Mińsku
   (uziarnienie gp → III, woda w profilu → I). Poziom oceny i tak ostrzega (`risk`), bo bilans strefy korzeniowej,
   liczony z wody w profilu, widzi stres; pewność jest niska, bo sąsiednia kategoria zmienia werdykt.
2. **Siatka NASA POWER 0,5° × 0,625°** uśrednia opad z ok. 55 × 43 km. IUNG liczy KBW z interpolacji stacji
   IMGW. Różnica kilkunastu–kilkudziesięciu mm na okres jest możliwa (Zielona Góra: −170 mm przy progu kat. I −152).
3. **Punkt, nie gmina.** Porównujemy jedno pole ok. 6 ha z punktem w gminie; IUNG ocenia całą gminę.
4. **Dobór uprawy dla „silnych epizodów” 2018 i 2019** (Doroszewski i Koza) jest nasz: praca opisuje regiony suszy,
   a uprawę i datę przyjęliśmy jako pszenicę ozimą 10 lipca i kukurydzę 31 lipca.

## Czego ta walidacja nie pokazuje

- Tylko 2 przypadki „brak suszy” — za mało, żeby ocenić fałszywe alarmy. Do dopisania: gminy bez suszy w raportach
  IUNG z lat wilgotnych (np. 2017, 2020) dla tych samych upraw.
- Nie porównaliśmy wykazów gmin (`susza.iung.pulawy.pl/wykazy/`) liczbowo — brama WWW IUNG nie odpowiada
  bezpośrednio z naszej sieci (błąd DNS, zob. notatka badawcza).
- Kategorii gleby nie porównaliśmy z mapą glebowo-rolniczą IUNG.

## Wniosek dla silnika

Poziom oceny jest wiarygodny (nie uspokaja przy suszy, nie alarmuje bez niej w sprawdzonych przypadkach). Słabym
punktem jest kategoria gleby: propozycja na następną rundę to kategoria z mapy glebowo-rolniczej (WMS IUNG) albo,
bez niej, przesunięcie wyboru w stronę lżejszego końca `categoryRange` (woda w profilu), gdy uziarnienie i woda
się różnią. Decyzja wymaga przypadków „brak suszy”, żeby nie zamienić niedoszacowania na fałszywe alarmy.
