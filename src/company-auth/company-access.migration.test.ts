import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const MIGRATION_PATH =
  'prisma/migrations/20260904140300_add_company_access_production_readiness/migration.sql';

test('company access migration adds credentials and durable web sessions without destructive data operations', async () => {
  const sql = await readFile(MIGRATION_PATH, 'utf8');

  assert.match(sql, /ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true/);
  assert.match(sql, /CREATE TABLE "CompanyCredential"/);
  assert.match(sql, /CREATE TABLE "CompanySession"/);
  assert.match(sql, /CREATE UNIQUE INDEX "CompanyCredential_companyId_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "CompanyCredential_email_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "CompanySession_tokenHash_key"/);
  assert.match(sql, /FOREIGN KEY \("companyId"\) REFERENCES "Company"\("id"\)/);
  assert.match(sql, /FOREIGN KEY \("credentialId"\) REFERENCES "CompanyCredential"\("id"\)/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM "Company"|DELETE FROM "Customer"|DELETE FROM "Appointment"/i);
});
