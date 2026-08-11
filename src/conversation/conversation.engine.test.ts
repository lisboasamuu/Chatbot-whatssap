import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ConversationEngine,
  DEFAULT_REPLY,
  FALLBACK_REPLY,
} from './conversation.engine.js';
import { ConversationStore } from './conversation.store.js';

test('starts a new conversation and transitions INITIAL to ACTIVE', () => {
  const store = new ConversationStore();
  const engine = new ConversationEngine(store);

  const result = engine.handle({
    conversationId: 'user-a',
    text: 'Olá',
    type: 'text',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
  assert.equal(store.get('user-a').state, 'ACTIVE');
});

test('keeps an existing conversation ACTIVE', () => {
  const engine = new ConversationEngine();

  engine.handle({
    conversationId: 'user-a',
    text: 'Primeira mensagem',
    type: 'text',
  });

  const result = engine.handle({
    conversationId: 'user-a',
    text: 'Segunda mensagem',
    type: 'text',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
});

test('keeps conversation state isolated by conversationId', () => {
  const store = new ConversationStore();
  const engine = new ConversationEngine(store);

  engine.handle({
    conversationId: 'user-a',
    text: 'Olá',
    type: 'text',
  });

  const userBResult = engine.handle({
    conversationId: 'user-b',
    text: '   ',
    type: 'text',
  });

  assert.equal(store.get('user-a').state, 'ACTIVE');
  assert.equal(store.get('user-b').state, 'INITIAL');
  assert.equal(userBResult.state, 'INITIAL');
});

test('returns fallback for empty or whitespace-only text without advancing state', () => {
  const engine = new ConversationEngine();

  for (const text of ['', '   ']) {
    const result = engine.handle({
      conversationId: 'user-a',
      text,
      type: 'text',
    });

    assert.equal(result.reply, FALLBACK_REPLY);
    assert.equal(result.state, 'INITIAL');
  }
});

test('returns fallback for unsupported message type', () => {
  const engine = new ConversationEngine();

  const result = engine.handle({
    conversationId: 'user-a',
    text: '',
    type: 'unsupported',
  });

  assert.equal(result.reply, FALLBACK_REPLY);
  assert.equal(result.state, 'INITIAL');
});

test('conversation engine runs without creating a WhatsApp client', () => {
  const engine = new ConversationEngine();

  const result = engine.handle({
    conversationId: 'standalone-test',
    text: 'Olá',
    type: 'text',
  });

  assert.equal(result.state, 'ACTIVE');
});
