// Uprawy, ktore rolnik moze wybrac do analizy. Lista identyfikatorow jest wspolna dla formularza (apps/web) i silnika
// (apps/server); parametry agronomiczne (Kc, korzenie, fazy) zyja w silniku: apps/server/src/domain/crops.
// Nazwy dla rolnika sa w tlumaczeniach, nie tutaj.
import { z } from 'zod';

export const CROP_IDS = [
  'winter_wheat',
  'spring_barley',
  'maize_grain',
  'maize_silage',
  'winter_rapeseed',
  'potato',
  'sugar_beet',
  'pulses',
  'strawberry',
  'berry_shrubs',
  'fruit_trees',
  'hops',
  'tobacco',
  'field_vegetables',
  'grassland',
] as const;

export const cropIdSchema = z.enum(CROP_IDS);

export type CropId = z.infer<typeof cropIdSchema>;

/**
 * Grupy upraw z tabeli wartosci progowych klimatycznego bilansu wodnego (System Monitoringu Suszy Rolniczej
 * IUNG-PIB, rozporzadzenie MRiRW z 11.04.2019). Trwale uzytki zielone nie maja progow - ich grupa to null.
 */
export const IUNG_CROP_GROUPS = [
  'winter_cereals',
  'spring_cereals',
  'maize_grain',
  'maize_silage',
  'rapeseed',
  'potato',
  'sugar_beet',
  'hops',
  'tobacco',
  'field_vegetables',
  'berry_shrubs',
  'fruit_trees',
  'strawberry',
  'pulses',
] as const;

export const iungCropGroupSchema = z.enum(IUNG_CROP_GROUPS);

export type IungCropGroup = z.infer<typeof iungCropGroupSchema>;

/** Faza rozwoju uprawy w dacie analizy (krzywa Kc wg FAO-56). */
export const CROP_STAGES = ['dormant', 'initial', 'development', 'mid', 'late', 'harvested'] as const;

export const cropStageSchema = z.enum(CROP_STAGES);

export type CropStage = z.infer<typeof cropStageSchema>;
