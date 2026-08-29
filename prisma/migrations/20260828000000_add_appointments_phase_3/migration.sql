-- AlterEnum
ALTER TYPE "ConversationState" ADD VALUE 'SCHEDULING_DATE';
ALTER TYPE "ConversationState" ADD VALUE 'SCHEDULING_TIME';
ALTER TYPE "ConversationState" ADD VALUE 'SCHEDULING_CONFIRMATION';
ALTER TYPE "ConversationState" ADD VALUE 'CANCELING_SELECT';
ALTER TYPE "ConversationState" ADD VALUE 'CANCELING_CONFIRMATION';
ALTER TYPE "ConversationState" ADD VALUE 'RESCHEDULING_SELECT';
ALTER TYPE "ConversationState" ADD VALUE 'RESCHEDULING_DATE';
ALTER TYPE "ConversationState" ADD VALUE 'RESCHEDULING_TIME';
ALTER TYPE "ConversationState" ADD VALUE 'RESCHEDULING_CONFIRMATION';

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "context" JSONB;

-- CreateTable
CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_date_time_key" ON "Appointment"("date", "time");

-- CreateIndex
CREATE INDEX "Appointment_customerId_date_time_idx" ON "Appointment"("customerId", "date", "time");

-- AddForeignKey
ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
