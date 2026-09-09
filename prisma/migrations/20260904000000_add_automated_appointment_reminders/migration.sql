BEGIN;

ALTER TYPE "MessageTemplateType" ADD VALUE 'REMINDER';

CREATE TYPE "ReminderStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

ALTER TABLE "CompanySettings"
  ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderOffsets" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE "AppointmentReminder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "offsetMinutes" INTEGER NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "appointmentDate" TEXT NOT NULL,
  "appointmentTime" TEXT NOT NULL,
  "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL,
  "processingStartedAt" TIMESTAMP(3),
  "dispatchStartedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentReminder_companyId_appointmentId_offsetMinutes_scheduledFor_key"
  ON "AppointmentReminder"("companyId", "appointmentId", "offsetMinutes", "scheduledFor");

CREATE INDEX "AppointmentReminder_companyId_status_scheduledFor_idx"
  ON "AppointmentReminder"("companyId", "status", "scheduledFor");

CREATE INDEX "AppointmentReminder_companyId_status_nextAttemptAt_idx"
  ON "AppointmentReminder"("companyId", "status", "nextAttemptAt");

ALTER TABLE "AppointmentReminder"
  ADD CONSTRAINT "AppointmentReminder_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
