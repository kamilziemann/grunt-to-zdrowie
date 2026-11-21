// Sciezki do logow bez sekretow: Better Auth niesie jednorazowe tokeny w sciezce (reset hasla), a logi trafiaja do
// Cloudflare Observability. Dopisz tu kazda trase, ktora ma sekret w segmencie URL.
const SECRET_SEGMENTS = [
  /(\/reset-password\/)[^/?#]+/g,
  /(\/verify-email\/)[^/?#]+/g,
  /(\/magic-link\/)[^/?#]+/g,
];

export function redactPath(path: string): string {
  return SECRET_SEGMENTS.reduce((acc, pattern) => acc.replace(pattern, '$1[redacted]'), path);
}
