import type {
  ConversationSession,
  ConversationState,
} from './conversation.types.js';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface SaveMessageInput {
  conversationId: string;
  direction: MessageDirection;
  body: string;
}

export interface ConversationStore {
  getOrCreateSession(externalUserId: string): Promise<ConversationSession>;
  updateState(conversationId: string, state: ConversationState): Promise<void>;
  saveMessage(input: SaveMessageInput): Promise<void>;
}
