// Kazdy nieznany adres (`/en/zzz`, `/brand-book/x`) to 404 w powloce aplikacji: trasa-splat ma najnizszy priorytet,
// wiec lapie tylko to, czego nie dopasowala zadna inna, a `notFound()` obsluguje `notFoundComponent` layoutu `_app`
// (z tytulem 404 i statusem 404). Bez niej router konczylby na golym 404 dokumentu.
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/{-$locale}/_app/$')({
  beforeLoad: () => {
    throw notFound();
  },
});
