import type { ConversationStore } from './conversation.store.js';
import type {
  ConversationInput,
  ConversationResult,
  ConversationState,
} from './conversation.types.js';

export const FALLBACK_REPLY = 'Desculpe, não entendi.';
export const DEFAULT_REPLY = 'Olá! Sua mensagem foi recebida com sucesso.';

export class ConversationEngine {
  public constructor(private readonly store: ConversationStore) {}

  public async handle(input: ConversationInput): Promise<ConversationResult> {
    const externalUserId = input.conversationId.trim();

    if (!externalUserId) {
      return {
        conversationId: '',
        reply: FALLBACK_REPLY,
        state: 'INITIAL',
      };
    }

    const session = await this.store.getOrCreateSession(externalUserId);
    const messageType = input.type ?? 'text';
    const text = input.text?.trim() ?? '';

    await this.store.saveMessage({
      conversationId: session.id,
      direction: 'INBOUND',
      body: input.text ?? '',
    });

    if (messageType !== 'text' || !text) {
      return {
        conversationId: session.id,
        reply: FALLBACK_REPLY,
        state: session.state,
      };
    }

    const nextState = this.transition(session.state);

    if (nextState !== session.state) {
      await this.store.updateState(session.id, nextState);
    }

    return {
      conversationId: session.id,
      reply: DEFAULT_REPLY,
      state: nextState,
    };
  }

  public async recordOutbound(
    conversationId: string,
    body: string,
  ): Promise<void> {
    await this.store.saveMessage({
      conversationId,
      direction: 'OUTBOUND',
      body,
    });
  }

  private transition(currentState: ConversationState): ConversationState {
    switch (currentState) {
      case 'INITIAL':
        return 'ACTIVE';
      case 'ACTIVE':
        return 'ACTIVE';
    }
  }
}
