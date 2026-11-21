// Notatki zrodel danych (`SourceRef.note`) trafiaja do raportu dla rolnika, wiec sa po polsku. Bledy sieci i limity
// czasu przychodza z runtime'u po angielsku - tu zamieniamy je na krotkie zdanie, a oryginal zostaje w nawiasie dla
// doradcy, ktory zglasza problem.

/** Opis nieudanego zapytania do zrodla: limit czasu, przerwane polaczenie albo inny blad. */
export function failureNote(service: string, error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);

  if (name === 'TimeoutError' || /timed? ?out/i.test(message))
    return `${service}: brak odpowiedzi w limicie czasu`;

  if (name === 'AbortError') return `${service}: zapytanie przerwane`;

  return `${service}: błąd połączenia (${message})`;
}

/** Odpowiedz HTTP z bledem; 429 to limit zapytan dostawcy, 5xx - awaria po jego stronie. */
export function httpFailureNote(service: string, status: number): string {
  if (status === 429) return `${service}: przekroczony limit zapytań (HTTP 429), spróbuj za chwilę`;

  if (status >= 500) return `${service}: awaria usługi (HTTP ${status})`;

  return `${service}: błąd HTTP ${status}`;
}
