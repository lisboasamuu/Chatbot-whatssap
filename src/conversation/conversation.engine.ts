import { ConversationStore } from './conversation.store.js';
import type {
  ConversationInput,
  ConversationResult,
  ConversationState,
} from './conversation.types.js';

export const FALLBACK_REPLY = 'Desculpe, não entendi.';
export const DEFAULT_REPLY = 'Olá! Sua mensagem foi recebida com sucesso.';

export class ConversationEngine {
  public constructor(
    private readonly store: ConversationStore = new ConversationStore(),
  ) {}

  public handle(input: ConversationInput): ConversationResult {
    const conversationId = input.conversationId.trim();
    const currentState = this.getCurrentState(conversationId);

    if (!conversationId) {
      return {
        reply: FALLBACK_REPLY,
        state: currentState,
      };
    }

    const messageType = input.type ?? 'text';
    const text = input.text?.trim() ?? '';

    if (messageType !== 'text' || !text) {
      return {
        reply: FALLBACK_REPLY,
        state: currentState,
      };
    }

    switch (currentState) {
      case 'INITIAL':
        return this.activateConversation(conversationId);

      case 'ACTIVE':
        return {
          reply: DEFAULT_REPLY,
          state: 'ACTIVE',
        };
    }
  }

  private getCurrentState(conversationId: string): ConversationState {
    if (!conversationId) {
      return 'INITIAL';
    }

    return this.store.get(conversationId).state;
  }

  private activateConversation(conversationId: string): ConversationResult {
    const session = this.store.setState(conversationId, 'ACTIVE');

    return {
      reply: DEFAULT_REPLY,
      state: session.state,
    };
  }
}
