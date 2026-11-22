// Pamiec dzialek w D1 (tabela `parcel_record`): wiersz na identyfikator dzialki, nadpisywany przy odswiezeniu.
// Logike waznosci i zapasu przy awarii GUGiK trzyma nakladka infrastructure/parcel-memory - tu tylko odczyt i zapis.
import { parcelRecord, type Db, type ParcelRecordRow } from '@app/db';
import { eq } from 'drizzle-orm';

import type { ParcelMemoryStore, ParcelOrigin, StoredParcelRecord } from '../../domain/parcel-source';

const ORIGINS: readonly ParcelOrigin[] = ['uldk', 'egib-wfs'];

function toRecord(row: ParcelRecordRow): StoredParcelRecord | null {
  const origin = ORIGINS.find((known) => known === row.origin);

  // wiersz z nieznanym zrodlem (np. po zmianie listy) traktujemy jak brak - dzialka pobierze sie od nowa
  if (!origin) return null;

  return {
    id: row.id,
    number: row.number,
    region: row.region,
    commune: row.commune,
    county: row.county,
    voivodeship: row.voivodeship,
    geometry: row.geometry,
    origin,
    fetchedAt: row.fetchedAt,
    ...(row.landUse === null ? {} : { landUse: row.landUse }),
    ...(row.registryAreaHa === null ? {} : { registryAreaHa: row.registryAreaHa }),
  };
}

export function createParcelRecordsRepository(db: Db): ParcelMemoryStore {
  return {
    async get(id) {
      const [row] = await db.select().from(parcelRecord).where(eq(parcelRecord.id, id)).limit(1);

      return row ? toRecord(row) : null;
    },

    async put(id, record) {
      const values = {
        number: record.number,
        region: record.region,
        commune: record.commune,
        county: record.county,
        voivodeship: record.voivodeship,
        geometry: record.geometry,
        origin: record.origin,
        landUse: record.landUse ?? null,
        registryAreaHa: record.registryAreaHa ?? null,
        fetchedAt: record.fetchedAt,
      };

      await db
        .insert(parcelRecord)
        .values({ id, ...values })
        .onConflictDoUpdate({ target: parcelRecord.id, set: values });
    },
  };
}
