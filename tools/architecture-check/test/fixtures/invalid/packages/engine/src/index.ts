import { exportVideo } from './browser'; // cycles (z browser/index.ts)

export const lazyTypes = (): Promise<unknown> => import('./types'); // dynamic-import: poza allow
export const createFilm = (): string => String(exportVideo);
