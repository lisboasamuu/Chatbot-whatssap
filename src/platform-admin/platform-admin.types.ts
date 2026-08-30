export type CompanyStatus = 'ACTIVE' | 'INACTIVE';
export type Weekday =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type MessageTemplateType =
  | 'WELCOME' | 'APPOINTMENT_CREATED' | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED' | 'NO_APPOINTMENTS' | 'BUSINESS_CLOSED';
export type DepositType = 'NONE' | 'FIXED' | 'PERCENTAGE';

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
export interface PlatformCompanyDetail extends PlatformCompanySummary {
  businessHours: BusinessHourInput[];
  messageTemplates: MessageTemplateInput[];
  settings: CompanySettingsInput;
}
