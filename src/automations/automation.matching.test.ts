import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInboundText, phraseMatches } from './automation.matching.js';

test('normalizes accents, case, punctuation and repeated whitespace deterministically', () => {
  assert.equal(normalizeInboundText('  QUAIS   Serviços vocês oferecem??? '), 'quais servicos voces oferecem');
});

test('matches an exact normalized phrase', () => {
  assert.equal(phraseMatches('quais servicos', 'quais servicos'), true);
});

test('matches complete phrases inside a longer message', () => {
  assert.equal(phraseMatches('ola quero conhecer os planos hoje', 'quero conhecer'), true);
});

test('does not match a variation inside another word', () => {
  assert.equal(phraseMatches('servicos premium', 'rico'), false);
});
