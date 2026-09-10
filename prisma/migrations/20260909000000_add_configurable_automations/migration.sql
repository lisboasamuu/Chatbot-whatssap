CREATE TYPE "AutomationType" AS ENUM ('INBOUND', 'SCHEDULED');
CREATE TYPE "AutomationScheduleType" AS ENUM ('ONE_TIME', 'WEEKLY');
CREATE TYPE "AutomationRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "AutomationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "Automation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AutomationType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "responseBody" TEXT,
  "messageBody" TEXT,
  "scheduleType" "AutomationScheduleType",
  "oneTimeDate" TEXT,
  "oneTimeTime" TEXT,
  "weekdays" "Weekday"[] NOT NULL DEFAULT ARRAY[]::"Weekday"[],
  "times" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "nextRunAt" TIMESTAMP(3),
  "scheduleVersion" INTEGER NOT NULL DEFAULT 1,
  "processingStartedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationVariation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationVariation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRecipient" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "scheduleVersion" INTEGER NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationDelivery" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "recipientName" TEXT,
  "body" TEXT NOT NULL,
  "status" "AutomationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL,
  "processingStartedAt" TIMESTAMP(3),
  "dispatchStartedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Automation_companyId_id_key" ON "Automation"("companyId", "id");
CREATE INDEX "Automation_companyId_type_isActive_deletedAt_idx" ON "Automation"("companyId", "type", "isActive", "deletedAt");
CREATE INDEX "Automation_companyId_nextRunAt_processingStartedAt_idx" ON "Automation"("companyId", "nextRunAt", "processingStartedAt");
CREATE UNIQUE INDEX "AutomationVariation_automationId_normalizedValue_key" ON "AutomationVariation"("automationId", "normalizedValue");
CREATE INDEX "AutomationVariation_companyId_automationId_idx" ON "AutomationVariation"("companyId", "automationId");
CREATE UNIQUE INDEX "AutomationRecipient_automationId_customerId_key" ON "AutomationRecipient"("automationId", "customerId");
CREATE INDEX "AutomationRecipient_companyId_automationId_idx" ON "AutomationRecipient"("companyId", "automationId");
CREATE INDEX "AutomationRecipient_companyId_customerId_idx" ON "AutomationRecipient"("companyId", "customerId");
CREATE UNIQUE INDEX "AutomationRun_companyId_id_key" ON "AutomationRun"("companyId", "id");
CREATE UNIQUE INDEX "AutomationRun_automationId_scheduleVersion_scheduledFor_key" ON "AutomationRun"("automationId", "scheduleVersion", "scheduledFor");
CREATE INDEX "AutomationRun_companyId_status_scheduledFor_idx" ON "AutomationRun"("companyId", "status", "scheduledFor");
CREATE UNIQUE INDEX "AutomationDelivery_runId_customerId_key" ON "AutomationDelivery"("runId", "customerId");
CREATE INDEX "AutomationDelivery_companyId_status_nextAttemptAt_idx" ON "AutomationDelivery"("companyId", "status", "nextAttemptAt");
CREATE INDEX "AutomationDelivery_companyId_runId_status_idx" ON "AutomationDelivery"("companyId", "runId", "status");

ALTER TABLE "Automation" ADD CONSTRAINT "Automation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationVariation" ADD CONSTRAINT "AutomationVariation_companyId_automationId_fkey" FOREIGN KEY ("companyId", "automationId") REFERENCES "Automation"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRecipient" ADD CONSTRAINT "AutomationRecipient_companyId_automationId_fkey" FOREIGN KEY ("companyId", "automationId") REFERENCES "Automation"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRecipient" ADD CONSTRAINT "AutomationRecipient_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_companyId_automationId_fkey" FOREIGN KEY ("companyId", "automationId") REFERENCES "Automation"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationDelivery" ADD CONSTRAINT "AutomationDelivery_companyId_runId_fkey" FOREIGN KEY ("companyId", "runId") REFERENCES "AutomationRun"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationDelivery" ADD CONSTRAINT "AutomationDelivery_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
