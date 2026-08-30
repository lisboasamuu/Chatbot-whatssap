BEGIN;

CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
CREATE TYPE "MessageTemplateType" AS ENUM ('WELCOME', 'APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'NO_APPOINTMENTS', 'BUSINESS_CLOSED');
CREATE TYPE "DepositType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

ALTER TABLE "Company"
  ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE TABLE "CompanySettings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "pixEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pixKey" TEXT,
  "pixRecipientName" TEXT,
  "depositType" "DepositType" NOT NULL DEFAULT 'NONE',
  "depositValue" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessHour" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessHour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "MessageTemplateType" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");
CREATE UNIQUE INDEX "BusinessHour_companyId_weekday_startTime_endTime_key" ON "BusinessHour"("companyId", "weekday", "startTime", "endTime");
CREATE INDEX "BusinessHour_companyId_weekday_idx" ON "BusinessHour"("companyId", "weekday");
CREATE UNIQUE INDEX "MessageTemplate_companyId_type_key" ON "MessageTemplate"("companyId", "type");
CREATE INDEX "MessageTemplate_companyId_idx" ON "MessageTemplate"("companyId");
CREATE INDEX "Company_status_createdAt_idx" ON "Company"("status", "createdAt");

ALTER TABLE "CompanySettings"
  ADD CONSTRAINT "CompanySettings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessHour"
  ADD CONSTRAINT "BusinessHour_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageTemplate"
  ADD CONSTRAINT "MessageTemplate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve legacy behavior for the migrated default tenant: before this phase every
-- valid future HH:mm slot was allowed, so legacy data receives full-week availability.
INSERT INTO "BusinessHour" ("id", "companyId", "weekday", "startTime", "endTime", "createdAt", "updatedAt")
SELECT
  'legacy-' || lower(day_name),
  c."id",
  day_name::"Weekday",
  '00:00',
  '23:59',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (VALUES
  ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
  ('FRIDAY'), ('SATURDAY'), ('SUNDAY')
) AS days(day_name)
WHERE c."id" = 'default-company'
ON CONFLICT DO NOTHING;

COMMIT;
