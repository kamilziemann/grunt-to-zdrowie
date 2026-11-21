// Metadane strony w formacie `head()` tras TanStack (zamiast generateMetadata z Next): tytul z marka, opis, Open
// Graph, kanoniczny adres i wersje jezykowe (hreflang). Puste wartosci sa pomijane.
export interface SeoInput {
  siteName: string;
  title?: string;
  description?: string;
  /** typ Open Graph (domyslnie `website`) */
  type?: 'website' | 'article';
  /** pelny adres kanoniczny */
  canonical?: string;
  /** wersje jezykowe: kod jezyka -> pelny adres */
  alternates?: Record<string, string>;
  locale?: string;
  /** dodatkowe `og:*` / `article:*` */
  extra?: Record<string, string | undefined>;
  noindex?: boolean;
}

type Meta = { title: string } | { name: string; content: string } | { property: string; content: string };

export function seoHead(input: SeoInput): {
  meta: Meta[];
  links: { rel: string; href: string; hrefLang?: string }[];
} {
  const title = input.title ? `${input.title} · ${input.siteName}` : input.siteName;
  const graph: Record<string, string | undefined> = {
    'og:site_name': input.siteName,
    'og:title': input.title ?? input.siteName,
    'og:description': input.description,
    'og:type': input.type ?? 'website',
    'og:url': input.canonical,
    'og:locale': input.locale,
    ...input.extra,
  };
  const meta: Meta[] = [{ title }];

  if (input.description) meta.push({ name: 'description', content: input.description });
  if (input.noindex) meta.push({ name: 'robots', content: 'noindex, follow' });

  for (const [property, content] of Object.entries(graph)) {
    if (content) meta.push({ property, content });
  }

  const links = [
    ...(input.canonical ? [{ rel: 'canonical', href: input.canonical }] : []),
    ...Object.entries(input.alternates ?? {}).map(([hrefLang, href]) => ({
      rel: 'alternate',
      hrefLang,
      href,
    })),
  ];

  return { meta, links };
}
