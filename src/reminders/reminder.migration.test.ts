import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MIGRATION_PATH =
  'prisma/migrations/20260904000000_add_automated_appointment_reminders/migration.sql';

test('reminder migration creates durable state, indexes and domain idempotency', async () => {
  const sql = await readFile(MIGRATION_PATH, 'utf8');
  assert.match(sql, /CREATE TYPE "ReminderStatus" AS ENUM/);
  assert.match(sql, /CREATE TABLE "AppointmentReminder"/);
  assert.match(sql, /"status" "ReminderStatus" NOT NULL DEFAULT 'PENDING'/);
  assert.match(sql, /"attempts" INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /"lastError" TEXT/);
  assert.match(sql, /UNIQUE INDEX[\s\S]+"companyId", "appointmentId", "offsetMinutes", "scheduledFor"/);
  assert.match(sql, /FOR UPDATE|AppointmentReminder_companyId_status_scheduledFor_idx/);
  assert.doesNotMatch(sql, /FOREIGN KEY \("appointmentId"\)/);
});
