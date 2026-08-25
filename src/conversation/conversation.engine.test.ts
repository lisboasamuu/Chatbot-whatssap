import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ConversationEngine,
  DEFAULT_REPLY,
  FALLBACK_REPLY,
} from './conversation.engine.js';
import type {
  ConversationStore,
  SaveMessageInput,
} from './conversation.store.js';
import type {
  ConversationSession,
  ConversationState,
} from './conversation.types.js';

class InMemoryConversationStore implements ConversationStore {
  private readonly sessionsByUser = new Map<string, ConversationSession>();
  public readonly messages: SaveMessageInput[] = [];

  public async getOrCreateSession(
    externalUserId: string,
  ): Promise<ConversationSession> {
    const existing = this.sessionsByUser.get(externalUserId);
    if (existing) return existing;

    const session = { id: `conversation-${externalUserId}`, state: 'INITIAL' as const };
    this.sessionsByUser.set(externalUserId, session);
    return session;
  }

  public async updateState(
    conversationId: string,
    state: ConversationState,
  ): Promise<void> {
    for (const [userId, session] of this.sessionsByUser) {
      if (session.id === conversationId) {
        this.sessionsByUser.set(userId, { ...session, state });
        return;
      }
    }
  }

  public async saveMessage(input: SaveMessageInput): Promise<void> {
    this.messages.push(input);
  }

  public stateFor(externalUserId: string): ConversationState {
    return this.sessionsByUser.get(externalUserId)?.state ?? 'INITIAL';
  }
}

test('starts a new conversation and transitions INITIAL to ACTIVE', async () => {
  const store = new InMemoryConversationStore();
  const engine = new ConversationEngine(store);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'Olá',
    type: 'text',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
  assert.equal(store.stateFor('user-a'), 'ACTIVE');
});

test('keeps an existing conversation ACTIVE', async () => {
  const store = new InMemoryConversationStore();
  const engine = new ConversationEngine(store);

  await engine.handle({ conversationId: 'user-a', text: 'Primeira mensagem' });
  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'Segunda mensagem',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
});

test('keeps conversation state isolated by conversationId', async () => {
  const store = new InMemoryConversationStore();
  const engine = new ConversationEngine(store);

  await engine.handle({ conversationId: 'user-a', text: 'Olá' });
  const userBResult = await engine.handle({
    conversationId: 'user-b',
    text: '   ',
  });

  assert.equal(store.stateFor('user-a'), 'ACTIVE');
  assert.equal(store.stateFor('user-b'), 'INITIAL');
  assert.equal(userBResult.state, 'INITIAL');
});

test('returns fallback for invalid text without advancing state and persists inbound', async () => {
  const store = new InMemoryConversationStore();
  const engine = new ConversationEngine(store);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '   ',
    type: 'text',
  });

  assert.equal(result.reply, FALLBACK_REPLY);
  assert.equal(result.state, 'INITIAL');
  assert.equal(store.messages.length, 1);
  assert.equal(store.messages[0]?.direction, 'INBOUND');
});

test('returns fallback for unsupported message type', async () => {
  const engine = new ConversationEngine(new InMemoryConversationStore());

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '',
    type: 'unsupported',
  });

  assert.equal(result.reply, FALLBACK_REPLY);
  assert.equal(result.state, 'INITIAL');
});

test('records outbound only when explicitly confirmed by caller', async () => {
  const store = new InMemoryConversationStore();
  const engine = new ConversationEngine(store);
  const result = await engine.handle({ conversationId: 'user-a', text: 'Olá' });

  assert.equal(store.messages.length, 1);
  await engine.recordOutbound(result.conversationId, result.reply);
  assert.equal(store.messages.length, 2);
  assert.equal(store.messages[1]?.direction, 'OUTBOUND');
});

test('propagates persistence errors to the integration boundary', async () => {
  const store = new InMemoryConversationStore();
  store.getOrCreateSession = async () => {
    throw new Error('database unavailable');
  };
  const engine = new ConversationEngine(store);

  await assert.rejects(
    engine.handle({ conversationId: 'user-a', text: 'Olá' }),
    /database unavailable/,
  );
});
