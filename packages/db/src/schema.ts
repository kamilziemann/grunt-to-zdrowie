// Schemat D1 (SQLite): tylko dane aplikacji - zapisane raporty i pamiec dzialek (bez kont, ADR 0011).
// Nowa tabela: dopisz ja tutaj, potem `bun db:generate` i `bun db:migrate`.
// JSON trzymaj w kolumnach text z `mode: 'json'` i typuj kontraktami z @app/contracts - D1 nie ma typu JSON.
import type { ParcelGeometry, WaterReport } from '@app/contracts';
import { index, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// --- Raporty analiz -------------------------------------------------------------------------------------------
// Zapisany wynik analizy (wymog KOWR: wynik zapisany i odtwarzalny). Klucz = pole + uprawa + data + wersja silnika;
// `id` to identyfikator raportu (`meta.reportId`, skrot klucza), kolumny klucza sprawdzaja zgodnosc przy odczycie.
// Bez danych osobowych: pole to identyfikatory dzialek ewidencyjnych albo skrot geometrii.
export const analysisReport = sqliteTable(
  'analysis_report',
  {
    id: text('id').primaryKey(),
    fieldId: text('field_id').notNull(),
    cropId: text('crop_id').notNull(),
    analysisDate: text('analysis_date').notNull(),
    engineVersion: text('engine_version').notNull(),
    report: text('report', { mode: 'json' }).$type<WaterReport>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('analysis_report_field_idx').on(t.fieldId, t.analysisDate)],
);

// --- Pamiec dzialek -------------------------------------------------------------------------------------------
// Dzialka raz pobrana z GUGiK (ULDK albo zapasowy WFS ewidencji): kolejne odczyty po numerze nie zaleza od chwilowej
// dostepnosci i nocnego limitu GUGiK. Wiersz na identyfikator, nadpisywany przy odswiezeniu (`fetched_at` = kiedy
// GUGiK oddal te granice). Dane publiczne z ewidencji, bez danych osobowych (bez wlascicieli).
export const parcelRecord = sqliteTable(
  'parcel_record',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull(),
    region: text('region').notNull(),
    commune: text('commune').notNull(),
    county: text('county').notNull(),
    voivodeship: text('voivodeship').notNull(),
    geometry: text('geometry', { mode: 'json' }).$type<ParcelGeometry>().notNull(),
    /** ktore zrodlo GUGiK oddalo geometrie: 'uldk' albo 'egib-wfs' */
    origin: text('origin').notNull(),
    landUse: text('land_use', { mode: 'json' }).$type<string[]>(),
    registryAreaHa: real('registry_area_ha'),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [index('parcel_record_fetched_idx').on(t.fetchedAt)],
);

export type AnalysisReportRow = typeof analysisReport.$inferSelect;
export type ParcelRecordRow = typeof parcelRecord.$inferSelect;
