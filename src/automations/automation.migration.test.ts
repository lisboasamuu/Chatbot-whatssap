import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('automation migration adds tenant keys, idempotency and persistent delivery state', async () => {
  const sql = await readFile('prisma/migrations/20260909000000_add_configurable_automations/migration.sql', 'utf8');
  assert.match(sql, /CREATE TABLE "Automation"/);
  assert.match(sql, /CREATE TABLE "AutomationRun"/);
  assert.match(sql, /CREATE TABLE "AutomationDelivery"/);
  assert.match(sql, /AutomationRun_automationId_scheduleVersion_scheduledFor_key/);
  assert.match(sql, /AutomationDelivery_runId_customerId_key/);
  assert.match(sql, /AutomationRecipient_companyId_customerId_fkey/);
  assert.doesNotMatch(sql, /DROP TABLE|migrate reset|TRUNCATE/i);
});
