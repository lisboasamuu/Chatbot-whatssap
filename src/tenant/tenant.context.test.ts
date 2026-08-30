import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_COMPANY_ID,
  TenantNotFoundError,
  configuredCompanyId,
  resolveTenantContext,
  type CompanyLookup,
} from './tenant.context.js';

class FakeCompanyLookup implements CompanyLookup {
  public constructor(
    private readonly companies: ReadonlyMap<string, { id: string; name: string }>,
  ) {}

  public async findCompanyById(
    companyId: string,
  ): Promise<{ id: string; name: string } | null> {
    return this.companies.get(companyId) ?? null;
  }
}

test('missing tenant configuration resolves to the legacy default company id', () => {
  assert.equal(configuredCompanyId(undefined), DEFAULT_COMPANY_ID);
  assert.equal(configuredCompanyId('   '), DEFAULT_COMPANY_ID);
});

test('configured tenant is normalized and resolved from trusted backend lookup', async () => {
  const lookup = new FakeCompanyLookup(
    new Map([['company-a', { id: 'company-a', name: 'Company A' }]]),
  );

  assert.deepEqual(await resolveTenantContext(lookup, ' company-a '), {
    companyId: 'company-a',
    companyName: 'Company A',
  });
});

test('nonexistent configured tenant is rejected', async () => {
  await assert.rejects(
    resolveTenantContext(new FakeCompanyLookup(new Map()), 'missing-company'),
    TenantNotFoundError,
  );
});
