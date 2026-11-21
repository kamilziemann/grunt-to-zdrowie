// Naglowki odpowiedzi dla polityki i tagow - te same dla tras Start (`headers`) i API (middleware Hono).
import { CACHE_POLICIES, type CachePolicyName } from '../policies';
import { normalizeTags } from '../tags';

export const CACHE_TAG_HEADER = 'cache-tag';
export const EDGE_CACHE_CONTROL_HEADER = 'cloudflare-cdn-cache-control';

export function cacheHeaders(
  policyName: CachePolicyName,
  tags: readonly string[] = [],
): Record<string, string> {
  const policy = CACHE_POLICIES[policyName];

  if (!policy.edge) return { 'cache-control': policy.browser };

  return {
    'cache-control': policy.browser,
    [EDGE_CACHE_CONTROL_HEADER]: policy.edge,
    [CACHE_TAG_HEADER]: normalizeTags(tags).join(','),
  };
}
