import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MIGRATION_PATH =
  'prisma/migrations/20260830050000_add_multi_tenant_architecture/migration.sql';

test('multi-tenant migration preserves and assigns legacy data before NOT NULL', async () => {
  const sql = await readFile(MIGRATION_PATH, 'utf8');

  const customerBackfill = sql.indexOf(
    `UPDATE "Customer"\nSET "companyId" = 'default-company'`,
  );
  const conversationBackfill = sql.indexOf('UPDATE "Conversation" AS c');
  const appointmentBackfill = sql.indexOf('UPDATE "Appointment" AS a');
  const notNull = sql.indexOf(
    'ALTER TABLE "Customer" ALTER COLUMN "companyId" SET NOT NULL',
  );

  assert.ok(customerBackfill >= 0);
  assert.ok(conversationBackfill > customerBackfill);
  assert.ok(appointmentBackfill > conversationBackfill);
  assert.ok(notNull > appointmentBackfill);
  assert.match(sql, /INSERT INTO "Company".*default-company/s);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM "Customer"/i);
});
