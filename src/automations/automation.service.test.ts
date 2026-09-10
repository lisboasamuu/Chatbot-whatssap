import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { AutomationService } from './automation.service.js';

function matcherService(companyId: string, rows: Array<{
  id: string;
  normalizedValue: string;
  automation: { id: string; responseBody: string; createdAt: Date };
}>, seenCompanies: string[] = []): AutomationService {
  const prisma = {
    automationVariation: {
      findMany: async (query: { where: { companyId: string } }) => {
        seenCompanies.push(query.where.companyId);
        return rows;
      },
    },
  } as unknown as PrismaClient;
  return new AutomationService(prisma, companyId, 'America/Sao_Paulo');
}

test('inbound lookup is always scoped to the trusted service company', async () => {
  const seen: string[] = [];
  const service = matcherService('company-a', [], seen);
  await service.findReply('serviços');
  assert.deepEqual(seen, ['company-a']);
});

test('exact match wins over a longer contains candidate', async () => {
  const service = matcherService('company-a', [
    { id: 'v1', normalizedValue: 'servicos', automation: { id: 'a1', responseBody: 'EXACT', createdAt: new Date('2030-01-01') } },
    { id: 'v2', normalizedValue: 'quais servicos', automation: { id: 'a2', responseBody: 'LONGER', createdAt: new Date('2030-01-01') } },
  ]);
  assert.equal(await service.findReply('serviços'), 'EXACT');
});

test('most specific phrase wins when two configured rules contain-match', async () => {
  const service = matcherService('company-a', [
    { id: 'v1', normalizedValue: 'servicos', automation: { id: 'a1', responseBody: 'SHORT', createdAt: new Date('2030-01-01') } },
    { id: 'v2', normalizedValue: 'quais servicos', automation: { id: 'a2', responseBody: 'SPECIFIC', createdAt: new Date('2030-01-02') } },
  ]);
  assert.equal(await service.findReply('ola quais serviços vocês oferecem'), 'SPECIFIC');
});

test('no matching rule returns null instead of choosing an arbitrary response', async () => {
  const service = matcherService('company-a', [
    { id: 'v1', normalizedValue: 'servicos', automation: { id: 'a1', responseBody: 'REPLY', createdAt: new Date('2030-01-01') } },
  ]);
  assert.equal(await service.findReply('preço'), null);
});
