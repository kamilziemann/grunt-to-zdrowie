// Komunikaty stron bledu i 404 poziomu dokumentu (trasa __root: blad albo nieznany jezyk w adresie, zanim zadziala
// layout jezyka z pelnymi komunikatami).
// Ta granica jest w paczce JS kazdej trasy - import pelnych messages/{pl,en}.json dokladal ok. 44 KB gz do kazdej
// strony; tu tylko przestrzenie, ktorych uzywa. Zgodnosc z katalogami pilnuje global-error-messages.test.ts.
export const GLOBAL_ERROR_MESSAGES = {
  pl: {
    errors: {
      globalTitle: 'Aplikacja napotkała nieoczekiwany błąd',
    },
    common: {
      tryAgain: 'Spróbuj ponownie',
    },
    problems: {
      validation_failed: 'Dane są nieprawidłowe. Sprawdź wypełnione pola.',
      not_found: 'Nie znaleziono zasobu. Być może został usunięty.',
      conflict: 'Konflikt: zasób został w międzyczasie zmieniony. Odśwież i spróbuj ponownie.',
      forbidden: 'Brak uprawnień do tej operacji.',
      unauthorized: 'Ta operacja wymaga zalogowania.',
      rate_limited: 'Zbyt wiele żądań. Odczekaj chwilę i spróbuj ponownie.',
      payload_too_large: 'Przesłane dane są zbyt duże.',
      unsupported_media_type: 'Nieobsługiwany format danych.',
      upstream_failed: 'Nie udało się połączyć z API lub usługą zewnętrzną. Spróbuj ponownie.',
      not_configured: 'Ta funkcja nie jest skonfigurowana na serwerze (brak kluczy lub bindingów).',
      internal: 'Wewnętrzny błąd serwera. Spróbuj ponownie za chwilę.',
      unknown: 'Wystąpił nieoczekiwany błąd.',
      technicalDetails: 'Szczegóły techniczne',
    },
  },
  en: {
    errors: {
      globalTitle: 'The application ran into an unexpected error',
    },
    common: {
      tryAgain: 'Try again',
    },
    problems: {
      validation_failed: 'The data is invalid. Check the filled-in fields.',
      not_found: 'Resource not found. It may have been deleted.',
      conflict: 'Conflict: the resource was changed in the meantime. Refresh and try again.',
      forbidden: 'You do not have permission for this operation.',
      unauthorized: 'This operation requires signing in.',
      rate_limited: 'Too many requests. Wait a moment and try again.',
      payload_too_large: 'The submitted data is too large.',
      unsupported_media_type: 'Unsupported data format.',
      upstream_failed: 'Could not reach the API or an external service. Try again.',
      not_configured: 'This feature is not configured on the server (missing keys or bindings).',
      internal: 'Internal server error. Try again in a moment.',
      unknown: 'An unexpected error occurred.',
      technicalDetails: 'Technical details',
    },
  },
} as const;
