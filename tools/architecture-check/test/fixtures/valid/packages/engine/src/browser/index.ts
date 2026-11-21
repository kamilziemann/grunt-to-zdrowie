import type { Film } from '../types';

export async function exportVideo(film: Film): Promise<number> {
  const { createFilm } = await import('../index');
  return film.duration + createFilm({ id: 'x' }).length;
}
