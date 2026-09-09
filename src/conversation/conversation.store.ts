import type {
  ConversationContext,
  ConversationSession,
  ConversationState,
} from './conversation.types.js';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface SaveMessageInput {
  conversationId: string;
  direction: MessageDirection;
  body: string;
}

export interface UpdateSessionInput {
  state: ConversationState;
  context: ConversationContext | null;
}

export interface ConversationStore {
  getOrCreateSession(externalUserId: string): Promise<ConversationSession>;
  updateSession(
    conversationId: string,
    input: UpdateSessionInput,
  ): Promise<void>;
  updateState(conversationId: string, state: ConversationState): Promise<void>;
  saveMessage(input: SaveMessageInput): Promise<void>;
}
