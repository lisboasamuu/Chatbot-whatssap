import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWhatsAppNumber, validateAutomationInput } from './automation.service.js';

const NOW = new Date('2030-01-01T10:00:00.000Z');

test('accepts one inbound variation', () => {
  const result = validateAutomationInput({
    name: 'Serviços', type: 'INBOUND', isActive: true,
    variations: ['quais serviços'], responseBody: 'Trabalhamos com tecnologia.',
  }, 'America/Sao_Paulo', NOW);
  assert.equal(result.type, 'INBOUND');
});

test('accepts ten inbound variations and rejects an eleventh', () => {
  const base = { name: 'Serviços', type: 'INBOUND' as const, isActive: true, responseBody: 'Resposta' };
  assert.doesNotThrow(() => validateAutomationInput({ ...base, variations: Array.from({ length: 10 }, (_, index) => `variação ${index}`) }, 'America/Sao_Paulo', NOW));
  assert.throws(() => validateAutomationInput({ ...base, variations: Array.from({ length: 11 }, (_, index) => `variação ${index}`) }, 'America/Sao_Paulo', NOW), /1 a 10/);
});

test('rejects variations that normalize to the same value', () => {
  assert.throws(() => validateAutomationInput({
    name: 'Duplicada', type: 'INBOUND', isActive: true,
    variations: ['serviços', 'SERVICOS!!!'], responseBody: 'Resposta',
  }, 'America/Sao_Paulo', NOW), /equivalentes/);
});

test('accepts three weekly times and rejects a fourth', () => {
  const base = {
    name: 'Promoção', type: 'SCHEDULED' as const, isActive: true,
    messageBody: 'Mensagem', scheduleType: 'WEEKLY' as const,
    weekdays: ['MONDAY' as const], recipientIds: ['customer-a'],
  };
  assert.doesNotThrow(() => validateAutomationInput({ ...base, times: ['09:00', '15:00', '18:00'] }, 'America/Sao_Paulo', NOW));
  assert.throws(() => validateAutomationInput({ ...base, times: ['08:00', '09:00', '15:00', '18:00'] }, 'America/Sao_Paulo', NOW), /1 a 3/);
});

test('rejects duplicated weekly times', () => {
  assert.throws(() => validateAutomationInput({
    name: 'Promoção', type: 'SCHEDULED', isActive: true, messageBody: 'Mensagem',
    scheduleType: 'WEEKLY', weekdays: ['MONDAY'], times: ['09:00', '09:00'], recipientIds: ['customer-a'],
  }, 'America/Sao_Paulo', NOW), /duplicad/);
});

test('normalizes Brazilian manual phone numbers and preserves provider ids', () => {
  assert.equal(normalizeWhatsAppNumber('(11) 99999-9999'), '5511999999999@c.us');
  assert.equal(normalizeWhatsAppNumber('+55 11 99999-9999'), '5511999999999@c.us');
  assert.equal(normalizeWhatsAppNumber('5511999999999@c.us'), '5511999999999@c.us');
});

test('rejects syntactically invalid phone numbers', () => {
  assert.throws(() => normalizeWhatsAppNumber('123'), /WhatsApp válido/);
});
