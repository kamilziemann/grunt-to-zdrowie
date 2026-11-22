// `import.meta.glob` (Vite) w testach: wszystkie nagrania z katalogu fixture'ow bez recznej listy importow,
// a z `query: '?raw'` - tresc plikow jako tekst (test listy miar czyta zrodla regul).
interface ImportMeta {
  glob<Module = unknown>(
    pattern: string,
    options: { eager: true; query?: string; import?: string },
  ): Record<string, Module>;
}
