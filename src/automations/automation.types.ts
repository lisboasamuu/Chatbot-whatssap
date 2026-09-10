export const MAX_INBOUND_VARIATIONS = 10;
export const MAX_WEEKLY_TIMES = 3;
export const MAX_AUTOMATION_RECIPIENTS = 200;
export const MAX_AUTOMATION_NAME_LENGTH = 100;
export const MAX_AUTOMATION_MESSAGE_LENGTH = 4000;

export type AutomationType = 'INBOUND' | 'SCHEDULED';
export type AutomationScheduleType = 'ONE_TIME' | 'WEEKLY';
export type AutomationWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface AutomationInput {
  name: string;
  type: AutomationType;
  isActive: boolean;
  variations?: string[];
  responseBody?: string;
  messageBody?: string;
  scheduleType?: AutomationScheduleType;
  oneTimeDate?: string | null;
  oneTimeTime?: string | null;
  weekdays?: AutomationWeekday[];
  times?: string[];
  recipientIds?: string[];
}

export class AutomationValidationError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AutomationValidationError';
  }
}

export class AutomationNotFoundError extends Error {
  public constructor() {
    super('Automação não encontrada.');
    this.name = 'AutomationNotFoundError';
  }
}

export interface InboundAutomationMatcher {
  findReply(text: string): Promise<string | null>;
}
