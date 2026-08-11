import type {
  ConversationSession,
  ConversationState,
} from './conversation.types.js';

const INITIAL_STATE: ConversationState = 'INITIAL';

export class ConversationStore {
  private readonly sessions = new Map<string, ConversationSession>();

  public get(conversationId: string): ConversationSession {
    return this.sessions.get(conversationId) ?? { state: INITIAL_STATE };
  }

  public setState(
    conversationId: string,
    state: ConversationState,
  ): ConversationSession {
    const session = { state };
    this.sessions.set(conversationId, session);

    return session;
  }
}
