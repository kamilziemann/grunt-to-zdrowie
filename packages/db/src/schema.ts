// Schemat D1 (SQLite). Nowa tabela: dopisz ja tutaj, potem `bun db:generate` i `bun db:migrate`.
// JSON trzymaj w kolumnach text z `mode: 'json'` i typuj kontraktami z @app/contracts - D1 nie ma typu JSON.
import { sql } from 'drizzle-orm';
import type { ParcelGeometry, WaterReport } from '@app/contracts';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// --- Auth (Better Auth) ---------------------------------------------------------------------------------------
// Tabele wymagane przez Better Auth (adapter drizzle, provider sqlite); odpowiadaja wynikowi `bunx @better-auth/cli
// generate` dla konfiguracji z packages/auth (kolumny, indeksy, daty jako timestamp_ms). Beda puste, dopoki
// AUTH_ENABLED nie jest wlaczone. Zmiana pluginow Better Auth = ponowny `generate`, porownanie i `bun db:generate`.
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(nowMs)
    .$onUpdate(() => new Date())
    .notNull(),
  // Pole dodatkowe (additionalFields w packages/auth): lista rol jako tekst JSON; nadaje je wylacznie backend.
  roles: text('roles').notNull().default('[]'),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_userId_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('account_userId_idx').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowMs).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(nowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// Liczniki limitu zapytan Better Auth (`rateLimit.storage: 'database'` w packages/auth): wiersz na klucz `ip|sciezka`.
// Licznik w pamieci nie dziala na Workers (kazdy isolat liczylby osobno), dlatego trzymamy go w D1.
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  // epoch ms ostatniego zapytania w oknie (Better Auth porownuje liczby, nie daty)
  lastRequest: integer('last_request').notNull(),
});

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

export type UserRow = typeof user.$inferSelect;
export type AnalysisReportRow = typeof analysisReport.$inferSelect;
export type ParcelRecordRow = typeof parcelRecord.$inferSelect;
