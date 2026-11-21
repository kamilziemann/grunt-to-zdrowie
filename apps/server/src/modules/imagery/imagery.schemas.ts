// Schematy OpenAPI modulu imagery (pokaz trybu 3D). Kontrakt zyje tu, a nie w @app/contracts, bo to pokaz: gdy tryb
// 3D wejdzie do produktu, schematy przechodza do packages/contracts (docs/progress/2026-11-21/tryb-3d-poc.md).
import { isoDateSchema } from '@app/contracts';
import { z } from '@hono/zod-openapi';

const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const vegetationQuery = z.object({
  /** identyfikatory dzialek po przecinku (jak `?dzialki=` stron) */
  dzialki: z.string().min(1).max(2000),
  /** ostatni dzien okna szukania zdjecia; brak = dzis */
  data: isoDateSchema.optional(),
});

export const vegetationImageryDto = z
  .object({
    images: z
      .array(z.object({ image: z.string(), bbox: bboxSchema }))
      .meta({ description: 'PNG na dzialke jako data URL (NDVI na wspolnej skali, przyciety do dzialki)' }),
    bbox: bboxSchema,
    requestedDate: isoDateSchema,
    sceneDate: isoDateSchema,
    sceneCloudCover: z.number(),
    clearShare: z.number(),
    ndvi: z.object({ low: z.number(), high: z.number(), mean: z.number() }),
  })
  .meta({ id: 'VegetationImagery' });
