// DTO API wspolne dla wszystkich modulow: paginacja, parametry, health. Routing i OpenAPI sa w apps/server.
import { z } from 'zod';

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Strona listy: elementy + kursor nastepnej strony (null = koniec). */
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });

export const healthSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  version: z.string(),
  environment: z.string(),
  time: z.string(),
});

export type Health = z.infer<typeof healthSchema>;
