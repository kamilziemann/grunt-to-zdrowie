import { format } from './format'; // cycles (z format.ts)

export const nowIso = (): string => format(new Date());
