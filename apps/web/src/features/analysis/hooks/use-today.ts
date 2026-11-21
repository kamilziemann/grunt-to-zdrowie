// Dzisiejsza data w Polsce tylko w przegladarce: HTML strony idzie z cache brzegowego, wiec "dzis" z SSR moglby byc
// wczorajszy. Podczas hydratacji hook oddaje null (jak serwer), a zaraz potem date z zegara przegladarki.
import type { IsoDate } from '@app/contracts';
import { useSyncExternalStore } from 'react';

import { todayInPoland } from '../schemas/analysis-search.schema';

const subscribe = () => () => {};
const serverSnapshot = () => null;

export function useToday(): IsoDate | null {
  return useSyncExternalStore(subscribe, todayInPoland, serverSnapshot);
}
