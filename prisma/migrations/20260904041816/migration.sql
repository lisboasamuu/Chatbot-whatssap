-- DropIndex
DROP INDEX "Appointment_customerId_date_time_idx";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "AppointmentReminder_companyId_appointmentId_offsetMinutes_sched" RENAME TO "AppointmentReminder_companyId_appointmentId_offsetMinutes_s_key";
