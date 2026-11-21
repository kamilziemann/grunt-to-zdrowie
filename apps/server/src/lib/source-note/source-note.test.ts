import { describe, expect, it } from 'vitest';

import { failureNote, httpFailureNote } from './source-note';

describe('failureNote', () => {
  it('limit czasu, przerwanie i inny blad po polsku', () => {
    const timeout = new Error('The operation was aborted due to timeout');

    timeout.name = 'TimeoutError';

    const abort = new Error('aborted');

    abort.name = 'AbortError';

    expect(failureNote('NASA POWER', timeout)).toBe('NASA POWER: brak odpowiedzi w limicie czasu');
    expect(failureNote('SoilGrids', abort)).toBe('SoilGrids: zapytanie przerwane');
    expect(failureNote('MET Norway', new Error('fetch failed'))).toBe(
      'MET Norway: błąd połączenia (fetch failed)',
    );
  });

  it('kody HTTP: limit zapytan, awaria, inny blad', () => {
    expect(httpFailureNote('Copernicus', 429)).toContain('limit zapytań');
    expect(httpFailureNote('SoilGrids', 503)).toBe('SoilGrids: awaria usługi (HTTP 503)');
    expect(httpFailureNote('NASA POWER', 404)).toBe('NASA POWER: błąd HTTP 404');
  });
});
