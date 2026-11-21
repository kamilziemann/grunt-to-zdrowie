import { useQuery } from '@tanstack/react-query';

import { meQuery } from '../api/auth.queries';

/** Biezaca tozsamosc (`GET /me`) - w przegladarce na stronach publicznych, z SSR na trasach chronionych. */
export function useMe() {
  return useQuery(meQuery());
}
