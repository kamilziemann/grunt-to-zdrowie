// Klucze TanStack Query wspolne dla aplikacji (zdrowie API, tozsamosc). Feature z wlasnymi danymi trzyma klucze
// u siebie, obok queryOptions (`features/<x>/api/<x>.queries.ts`, np. `parcelsKeys`). Mutacje uniewazniaja klucze
// z tych obiektow - nigdy literalow w hookach.
export const queryKeys = {
  health: ['health'] as const,
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },
} as const;
