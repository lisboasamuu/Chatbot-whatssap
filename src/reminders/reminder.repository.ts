import type {
  AppointmentReminderRecord,
  EnsureReminderInput,
  ReminderAppointment,
  ReminderCompanyConfig,
} from './reminder.types.js';

export interface InterruptedRecoveryResult {
  requeued: number;
  failed: number;
}

export interface ReminderRepository {
  getCompanyConfig(companyId: string): Promise<ReminderCompanyConfig | null>;
  listAppointments(companyId: string): Promise<ReminderAppointment[]>;
  findAppointment(
    companyId: string,
    appointmentId: string,
  ): Promise<ReminderAppointment | null>;
  ensureReminder(input: EnsureReminderInput): Promise<void>;
  claimDue(
    companyId: string,
    now: Date,
    limit: number,
  ): Promise<AppointmentReminderRecord[]>;
  findReminder(
    companyId: string,
    reminderId: string,
  ): Promise<AppointmentReminderRecord | null>;
  markSkipped(
    companyId: string,
    reminderId: string,
    reason: string,
    now: Date,
  ): Promise<boolean>;
  markDispatchStarted(
    companyId: string,
    reminderId: string,
    now: Date,
  ): Promise<boolean>;
  markSent(
    companyId: string,
    reminderId: string,
    sentAt: Date,
    providerMessageId: string | null,
  ): Promise<boolean>;
  markForRetry(
    companyId: string,
    reminderId: string,
    nextAttemptAt: Date,
    error: string,
  ): Promise<boolean>;
  markFailed(
    companyId: string,
    reminderId: string,
    error: string,
    now: Date,
  ): Promise<boolean>;
  recoverInterrupted(
    companyId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<InterruptedRecoveryResult>;
}
