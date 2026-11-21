// Dane statyczne tras TanStack Router uzywane przez powloke aplikacji (`_app/route.tsx`).
import '@tanstack/react-router';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** strona zajmuje cala wysokosc okna pod naglowkiem (mapa) - bez kontenera, marginesow i stopki */
    fullBleed?: boolean;
  }
}
