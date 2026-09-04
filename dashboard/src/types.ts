export interface Company {
  id: string;
  name: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  customerExternalId: string;
  customerName: string | null;
  date: string;
  time: string;
}

export interface Customer {
  id: string;
  externalId: string;
  name: string | null;
  createdAt: string;
  appointmentCount: number;
}

export interface CustomerDetail extends Customer {
  updatedAt: string;
  appointments: Appointment[];
}

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface DashboardSummary {
  totalCustomers: number;
  appointmentsToday: number;
  upcomingAppointments: number;
  nextAppointments: Appointment[];
}

export type CompanyStatus = 'ACTIVE' | 'INACTIVE';
export type Weekday = 'MONDAY'|'TUESDAY'|'WEDNESDAY'|'THURSDAY'|'FRIDAY'|'SATURDAY'|'SUNDAY';
export type MessageTemplateType = 'WELCOME'|'APPOINTMENT_CREATED'|'APPOINTMENT_CANCELLED'|'APPOINTMENT_RESCHEDULED'|'NO_APPOINTMENTS'|'BUSINESS_CLOSED'|'REMINDER';
export type DepositType = 'NONE'|'FIXED'|'PERCENTAGE';
export type ReminderOffsetMinutes = 30|60|240|720|1440;

export interface PlatformCompany {
  id: string;
  name: string;
  status: CompanyStatus;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  customerCount: number;
  appointmentCount: number;
}
export interface BusinessHour { weekday: Weekday; startTime: string; endTime: string; }
export interface MessageTemplate { type: MessageTemplateType; body: string; }
export interface CompanySettings {
  pixEnabled: boolean;
  pixKey: string | null;
  pixRecipientName: string | null;
  depositType: DepositType;
  depositValue: number | null;
}
export interface ReminderSettings {
  enabled: boolean;
  offsets: ReminderOffsetMinutes[];
}
export interface PlatformCompanyDetail extends PlatformCompany {
  businessHours: BusinessHour[];
  messageTemplates: MessageTemplate[];
  settings: CompanySettings;
  reminders: ReminderSettings;
}
export interface PlatformSummary {
  totalCompanies:number; activeCompanies:number; inactiveCompanies:number; totalAppointments:number;
}
