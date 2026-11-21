import { nowIso } from './time'; // cycles

export const format = (d: Date): string => d.toISOString() + nowIso.name;
