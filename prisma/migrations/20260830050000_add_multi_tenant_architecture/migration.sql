-- Phase 5: shared-database/shared-schema multi-company architecture.
-- Legacy data is assigned to the stable default tenant without deleting records.

BEGIN;

CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Company" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-company', 'Samuel Lisboa', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Customer" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "companyId" TEXT;

UPDATE "Customer"
SET "companyId" = 'default-company'
WHERE "companyId" IS NULL;

UPDATE "Conversation" AS c
SET "companyId" = customer."companyId"
FROM "Customer" AS customer
WHERE c."customerId" = customer."id"
  AND c."companyId" IS NULL;

UPDATE "Appointment" AS a
SET "companyId" = customer."companyId"
FROM "Customer" AS customer
WHERE a."customerId" = customer."id"
  AND a."companyId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Customer" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate: Customer rows without companyId remain';
  END IF;
  IF EXISTS (SELECT 1 FROM "Conversation" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate: Conversation rows without companyId remain';
  END IF;
  IF EXISTS (SELECT 1 FROM "Appointment" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate: Appointment rows without companyId remain';
  END IF;
END $$;

ALTER TABLE "Customer" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Conversation" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX IF EXISTS "Customer_externalId_key";
DROP INDEX IF EXISTS "Conversation_customerId_key";
DROP INDEX IF EXISTS "Appointment_date_time_key";

ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_customerId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_customerId_fkey";

CREATE UNIQUE INDEX "Customer_companyId_externalId_key"
ON "Customer"("companyId", "externalId");

CREATE UNIQUE INDEX "Customer_companyId_id_key"
ON "Customer"("companyId", "id");

CREATE INDEX "Customer_companyId_createdAt_idx"
ON "Customer"("companyId", "createdAt");

CREATE UNIQUE INDEX "Conversation_companyId_customerId_key"
ON "Conversation"("companyId", "customerId");

CREATE UNIQUE INDEX "Conversation_companyId_id_key"
ON "Conversation"("companyId", "id");

CREATE INDEX "Conversation_companyId_updatedAt_idx"
ON "Conversation"("companyId", "updatedAt");

CREATE UNIQUE INDEX "Appointment_companyId_date_time_key"
ON "Appointment"("companyId", "date", "time");

CREATE UNIQUE INDEX "Appointment_companyId_id_key"
ON "Appointment"("companyId", "id");

CREATE INDEX "Appointment_companyId_customerId_date_time_idx"
ON "Appointment"("companyId", "customerId", "date", "time");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_companyId_customerId_fkey"
FOREIGN KEY ("companyId", "customerId")
REFERENCES "Customer"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_companyId_customerId_fkey"
FOREIGN KEY ("companyId", "customerId")
REFERENCES "Customer"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Conversation" c
    LEFT JOIN "Customer" customer
      ON customer."companyId" = c."companyId"
     AND customer."id" = c."customerId"
    WHERE customer."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: Conversation tenant integrity validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment" a
    LEFT JOIN "Customer" customer
      ON customer."companyId" = a."companyId"
     AND customer."id" = a."customerId"
    WHERE customer."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: Appointment tenant integrity validation failed';
  END IF;
END $$;

COMMIT;
