export type ConversationState =
  | 'INITIAL'
  | 'ACTIVE'
  | 'SCHEDULING_DATE'
  | 'SCHEDULING_TIME'
  | 'SCHEDULING_CONFIRMATION'
  | 'CANCELING_SELECT'
  | 'CANCELING_CONFIRMATION'
  | 'RESCHEDULING_SELECT'
  | 'RESCHEDULING_DATE'
  | 'RESCHEDULING_TIME'
  | 'RESCHEDULING_CONFIRMATION';

export type ConversationMessageType = 'text' | 'unsupported';

export interface ConversationInput {
  conversationId: string;
  text?: string;
  type?: ConversationMessageType;
}

export interface ConversationResult {
  conversationId: string;
  reply: string;
  state: ConversationState;
}

export interface ConversationContext {
  draftDate?: string;
  draftTime?: string;
  selectedAppointmentId?: string;
}

export interface ConversationSession {
  id: string;
  customerId: string;
  state: ConversationState;
  context: ConversationContext | null;
}

export function parseConversationContext(
  value: unknown,
): ConversationContext | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const context: ConversationContext = {};

  if (typeof record.draftDate === 'string') {
    context.draftDate = record.draftDate;
  }

  if (typeof record.draftTime === 'string') {
    context.draftTime = record.draftTime;
  }

  if (typeof record.selectedAppointmentId === 'string') {
    context.selectedAppointmentId = record.selectedAppointmentId;
  }

  return context;
}
