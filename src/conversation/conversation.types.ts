export type ConversationState = 'INITIAL' | 'ACTIVE';

export type ConversationMessageType = 'text' | 'unsupported';

export interface ConversationInput {
  conversationId: string;
  text?: string;
  type?: ConversationMessageType;
}

export interface ConversationResult {
  reply: string;
  state: ConversationState;
}

export interface ConversationSession {
  state: ConversationState;
}
