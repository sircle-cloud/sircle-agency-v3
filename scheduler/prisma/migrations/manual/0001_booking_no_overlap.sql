-- Harde dubbel-boek-garantie op DB-niveau (§7 van het plan).
-- Prisma kan dit niet native uitdrukken; draai deze migratie handmatig ná
-- `prisma migrate`. De database weigert dan elke overlappende bevestigde
-- boeking voor dezelfde host binnen dezelfde tenant — ook onder gelijktijdige
-- requests (race-conditions).

-- Vereiste extensie voor GiST-index op scalair + range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion-constraint: geen twee CONFIRMED boekingen van dezelfde
-- (tenant, host) met overlappende [startUtc, endUtc)-periode.
-- We gebruiken een partiële constraint zodat geannuleerde boekingen niet meetellen.
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "hostUserId" WITH =,
    tstzrange("startUtc", "endUtc", '[)') WITH &&
  )
  WHERE (status = 'confirmed');
