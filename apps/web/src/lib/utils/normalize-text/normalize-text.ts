// Normalizacja tekstu do porownan (wyszukiwarka, podpowiedzi): czysta funkcja, wspolna dla serwera i przegladarki.

/** „Składka Zdrowotna” -> „skladka zdrowotna”: porownania bez wielkosci liter i polskich znakow. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ł', 'l')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
