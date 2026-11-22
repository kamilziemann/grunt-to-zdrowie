// Jak aplikacja przedstawia sie zewnetrznym uslugom danych. MET Norway i Nominatim wymagaja w User-Agent nazwy
// aplikacji i kontaktu do operatora (bez tego blokuja ruch); pozostale zrodla dostaja ten sam naglowek, zeby dalo
// sie nas zidentyfikowac przy problemach z limitem. Jedno miejsce - zmiana kontaktu to jedna linia.
const CONTACT = 'admin@grunttozdrowie-hackathon.pl';

export const OUTBOUND_USER_AGENT = `grunt-to-zdrowie/0.1 (${CONTACT})`;
