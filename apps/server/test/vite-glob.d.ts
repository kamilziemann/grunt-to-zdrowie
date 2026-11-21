// `import.meta.glob` (Vite) w testach: wszystkie nagrania z katalogu fixture'ow bez recznej listy importow.
interface ImportMeta {
  glob<Module = unknown>(pattern: string, options: { eager: true }): Record<string, Module>;
}
