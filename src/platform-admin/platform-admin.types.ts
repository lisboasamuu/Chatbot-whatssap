import type { MessageTemplateType } from '../message-templates/message-template.js';

export type { MessageTemplateType } from '../message-templates/message-template.js';

export type CompanyStatus = 'ACTIVE' | 'INACTIVE';
export type Weekday =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type DepositType = 'NONE' | 'FIXED' | 'PERCENTAGE';
export type ReminderOffsetMinutes = 30 | 60 | 240 | 720 | 1440;

export interface PlatformCompanySummary {
  id: string; name: string; status: CompanyStatus; timezone: string;
  createdAt: Date; updatedAt: Date; customerCount: number; appointmentCount: number;
}
export interface BusinessHourInput { weekday: Weekday; startTime: string; endTime: string; }
export interface MessageTemplateInput { type: MessageTemplateType; body: string; }
export interface CompanySettingsInput {
  pixEnabled: boolean; pixKey: string | null; pixRecipientName: string | null;
  depositType: DepositType; depositValue: number | null;
}
export interface ReminderConfigurationInput {
  enabled: boolean;
  offsets: ReminderOffsetMinutes[];
  message: string | null;
}
export interface ReminderSettings {
  enabled: boolean;
  offsets: ReminderOffsetMinutes[];
}
export interface PlatformCompanyDetail extends PlatformCompanySummary {
  businessHours: BusinessHourInput[];
  messageTemplates: MessageTemplateInput[];
  settings: CompanySettingsInput;
  reminders: ReminderSettings;
}
