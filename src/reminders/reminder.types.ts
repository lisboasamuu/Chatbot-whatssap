export const REMINDER_OFFSETS = [1440, 720, 240, 60, 30] as const;

export type ReminderOffsetMinutes = (typeof REMINDER_OFFSETS)[number];
export type ReminderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED';

export interface AppointmentReminderRecord {
  id: string;
  companyId: string;
  appointmentId: string;
  offsetMinutes: number;
  scheduledFor: Date;
  appointmentDate: string;
  appointmentTime: string;
  status: ReminderStatus;
  attempts: number;
  nextAttemptAt: Date;
  processingStartedAt: Date | null;
  dispatchStartedAt: Date | null;
  sentAt: Date | null;
  providerMessageId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderCompanyConfig {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  timezone: string;
  remindersEnabled: boolean;
  reminderOffsets: number[];
  reminderTemplate: string | null;
}

export interface ReminderAppointment {
  id: string;
  companyId: string;
  customerId: string;
  customerExternalId: string;
  customerName: string | null;
  date: string;
  time: string;
}

export interface EnsureReminderInput {
  companyId: string;
  appointmentId: string;
  offsetMinutes: ReminderOffsetMinutes;
  scheduledFor: Date;
  appointmentDate: string;
  appointmentTime: string;
}

export type Clock = () => Date;
