import {
  HTTP_STATUS_BY_CODE,
  PROBLEM_CODES,
  problemType,
  type ProblemCode,
  type ProblemDetails,
} from '@app/contracts';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { describeProblem, problemMessage } from '@/lib/problems';
import { renderWithIntl, translator } from '@/test/render-intl';

import { ProblemAlert } from './problem-alert';

function problem(code: ProblemCode, extra: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    type: problemType(code),
    title: 'English title',
    status: HTTP_STATUS_BY_CODE[code],
    code,
    ...extra,
  };
}

const ALL_CODES = Object.values(PROBLEM_CODES);
const tPl = translator('problems');
const tEn = translator('problems', 'en');

describe('ProblemAlert', () => {
  it.each(ALL_CODES)('pokazuje polski komunikat dla kodu %s', (code) => {
    renderWithIntl(<ProblemAlert problem={problem(code)} />);
    const alert = screen.getByRole('alert');

    expect(alert).toHaveAttribute('data-problem-code', code);
    expect(within(alert).getByText(tPl(code))).toBeInTheDocument();
    // komunikat jest po polsku, a nie angielskim tytulem z API
    expect(within(alert).queryByText('English title')).not.toBeInTheDocument();
  });

  it('mapuje konkretne kody na oczekiwane komunikaty', () => {
    expect(problemMessage(tPl, PROBLEM_CODES.NOT_FOUND)).toBe(
      'Nie znaleziono zasobu. Być może został usunięty.',
    );
    expect(problemMessage(tPl, PROBLEM_CODES.RATE_LIMITED)).toBe(
      'Zbyt wiele żądań. Odczekaj chwilę i spróbuj ponownie.',
    );
    expect(problemMessage(tPl, PROBLEM_CODES.UPSTREAM_FAILED)).toContain('API');
  });

  it('ten sam kod w angielskim interfejsie daje angielski komunikat', () => {
    renderWithIntl(<ProblemAlert problem={problem(PROBLEM_CODES.FORBIDDEN)} />, 'en');

    expect(screen.getByText(tEn(PROBLEM_CODES.FORBIDDEN))).toBeInTheDocument();
    expect(tEn(PROBLEM_CODES.FORBIDDEN)).not.toBe(tPl(PROBLEM_CODES.FORBIDDEN));
  });

  it('dla nieznanego kodu lub jego braku zwraca komunikat ogólny', () => {
    expect(problemMessage(tPl, 'totally_unknown')).toBe('Wystąpił nieoczekiwany błąd.');
    expect(problemMessage(tPl, undefined)).toBe('Wystąpił nieoczekiwany błąd.');
  });

  it('własny tytuł wypiera komunikat z nagłówka, ale komunikat zostaje w treści', () => {
    renderWithIntl(
      <ProblemAlert problem={problem(PROBLEM_CODES.NOT_FOUND)} title="Nie udało się wczytać historii" />,
    );
    expect(screen.getByText('Nie udało się wczytać historii')).toBeInTheDocument();
    expect(screen.getByText(tPl(PROBLEM_CODES.NOT_FOUND))).toBeInTheDocument();
  });

  it('wypisuje błędy walidacji z polami', () => {
    renderWithIntl(
      <ProblemAlert
        problem={problem(PROBLEM_CODES.VALIDATION_FAILED, {
          issues: [
            { path: 'meta.title', message: 'Required' },
            { path: '', message: 'Cały obiekt jest zły' },
          ],
        })}
      />,
    );
    const items = screen.getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('meta.title – Required');
    expect(items[1]).toHaveTextContent('Cały obiekt jest zły');
  });

  it('chowa szczegóły techniczne w <details> wraz z requestId', () => {
    renderWithIntl(
      <ProblemAlert
        problem={problem(PROBLEM_CODES.INTERNAL, { detail: 'D1 exploded', requestId: 'req-42' })}
      />,
    );
    expect(screen.getByText('Szczegóły techniczne')).toBeInTheDocument();
    expect(screen.getByText(/500 internal: D1 exploded \(requestId: req-42\)/)).toBeInTheDocument();
  });

  it('renderuje akcje przekazane jako children', () => {
    renderWithIntl(
      <ProblemAlert problem={problem(PROBLEM_CODES.UPSTREAM_FAILED)}>
        <button type="button">Spróbuj ponownie</button>
      </ProblemAlert>,
    );
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
  });
});

describe('describeProblem', () => {
  it('dokleja detail techniczny do polskiego komunikatu', () => {
    const text = describeProblem(tPl, problem(PROBLEM_CODES.CONFLICT, { detail: 'version mismatch' }));

    expect(text).toBe(`${tPl(PROBLEM_CODES.CONFLICT)} (version mismatch)`);
  });

  it('bez detail zwraca sam komunikat', () => {
    expect(describeProblem(tPl, problem(PROBLEM_CODES.FORBIDDEN))).toBe(tPl(PROBLEM_CODES.FORBIDDEN));
  });
});
