import { formatDateForDisplay } from '../appointments/appointment.types.js';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
} from '../message-templates/message-template.js';
import type { ReminderMessenger } from './reminder.messenger.js';
import type { ReminderRepository } from './reminder.repository.js';
import {
  REMINDER_OFFSETS,
  type AppointmentReminderRecord,
  type Clock,
  type ReminderAppointment,
  type ReminderCompanyConfig,
  type ReminderOffsetMinutes,
} from './reminder.types.js';
import { zonedDateTimeToUtc } from './timezone.js';

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_STALE_PROCESSING_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const MAX_ERROR_LENGTH = 1000;
const VALID_RECIPIENT = /^[^\s@]+@(c\.us|lid)$/;

export interface ReminderWorkerOptions {
  batchSize?: number;
  staleProcessingMs?: number;
}

function operationalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH) || 'Unknown operational error.';
}

function enabledOffsets(config: ReminderCompanyConfig): ReminderOffsetMinutes[] {
  return config.reminderOffsets.filter(
    (offset): offset is ReminderOffsetMinutes =>
      REMINDER_OFFSETS.includes(offset as ReminderOffsetMinutes),
  );
}

export class AppointmentReminderWorker {
  private readonly batchSize: number;
  private readonly staleProcessingMs: number;

  public constructor(
    private readonly repository: ReminderRepository,
    private readonly messenger: ReminderMessenger,
    private readonly companyId: string,
    private readonly clock: Clock = () => new Date(),
    options: ReminderWorkerOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.staleProcessingMs = options.staleProcessingMs ?? DEFAULT_STALE_PROCESSING_MS;
  }

  public async runOnce(): Promise<void> {
    const now = this.clock();
    await this.repository.recoverInterrupted(
      this.companyId,
      new Date(now.getTime() - this.staleProcessingMs),
      now,
    );
    await this.reconcile(now);

    const claimed = await this.repository.claimDue(this.companyId, now, this.batchSize);
    for (const reminder of claimed) {
      await this.dispatch(reminder);
    }
  }

  private async reconcile(now: Date): Promise<void> {
    const config = await this.repository.getCompanyConfig(this.companyId);
    if (!config || !config.remindersEnabled) return;

    const offsets = enabledOffsets(config);
    if (offsets.length === 0) return;

    const appointments = await this.repository.listAppointments(this.companyId);
    for (const appointment of appointments) {
      let appointmentAt: Date;
      try {
        appointmentAt = zonedDateTimeToUtc(
          appointment.date,
          appointment.time,
          config.timezone,
        );
      } catch (error) {
        console.error('[Reminder] Agendamento com data, hora ou timezone inválido:', operationalError(error));
        continue;
      }

      if (appointmentAt <= now) continue;
      for (const offsetMinutes of offsets) {
        const scheduledFor = new Date(
          appointmentAt.getTime() - offsetMinutes * 60_000,
        );
        if (scheduledFor < now) continue;

        await this.repository.ensureReminder({
          companyId: this.companyId,
          appointmentId: appointment.id,
          offsetMinutes,
          scheduledFor,
          appointmentDate: appointment.date,
          appointmentTime: appointment.time,
        });
      }
    }
  }

  private async dispatch(claimed: AppointmentReminderRecord): Promise<void> {
    const now = this.clock();
    const reminder = await this.repository.findReminder(this.companyId, claimed.id);
    if (!reminder || reminder.status !== 'PROCESSING') return;

    const config = await this.repository.getCompanyConfig(this.companyId);
    const appointment = await this.repository.findAppointment(
      this.companyId,
      reminder.appointmentId,
    );
    const ineligibility = this.ineligibilityReason(reminder, config, appointment, now);
    if (ineligibility) {
      await this.repository.markSkipped(this.companyId, reminder.id, ineligibility, now);
      return;
    }

    if (!(await this.messenger.isReady(this.companyId))) {
      await this.handleFailure(reminder, new Error('WhatsApp channel is not ready.'), now);
      return;
    }

    const dispatchStarted = await this.repository.markDispatchStarted(
      this.companyId,
      reminder.id,
      now,
    );
    if (!dispatchStarted) return;

    const validConfig = config as ReminderCompanyConfig;
    const validAppointment = appointment as ReminderAppointment;
    const body = renderMessageTemplate(
      'REMINDER',
      validConfig.reminderTemplate ?? DEFAULT_MESSAGE_TEMPLATES.REMINDER,
      {
        customerName: validAppointment.customerName?.trim() || 'cliente',
        date: formatDateForDisplay(validAppointment.date),
        time: validAppointment.time,
        companyName: validConfig.name,
      },
    );

    let result: Awaited<ReturnType<ReminderMessenger['sendReminder']>>;
    try {
      result = await this.messenger.sendReminder(
        this.companyId,
        validAppointment.customerExternalId,
        body,
      );
    } catch (error) {
      await this.handleFailure(reminder, error, this.clock());
      return;
    }

    const marked = await this.repository.markSent(
      this.companyId,
      reminder.id,
      this.clock(),
      result.messageId,
    );
    if (!marked) {
      console.error('[Reminder] WhatsApp confirmou o envio, mas o status persistente não foi atualizado.');
    }
  }

  private ineligibilityReason(
    reminder: AppointmentReminderRecord,
    config: ReminderCompanyConfig | null,
    appointment: ReminderAppointment | null,
    now: Date,
  ): string | null {
    if (!config) return 'Company no longer exists.';
    if (config.id !== reminder.companyId) return 'Reminder company does not match current company.';
    if (config.status !== 'ACTIVE') return 'Company is inactive.';
    if (!config.remindersEnabled) return 'Reminders are disabled for the company.';
    if (!enabledOffsets(config).includes(reminder.offsetMinutes as ReminderOffsetMinutes)) {
      return 'Reminder offset is no longer enabled.';
    }
    if (!appointment) return 'Appointment no longer exists.';
    if (appointment.companyId !== reminder.companyId) return 'Appointment belongs to another company.';
    if (
      appointment.date !== reminder.appointmentDate ||
      appointment.time !== reminder.appointmentTime
    ) {
      return 'Appointment was rescheduled.';
    }
    if (!VALID_RECIPIENT.test(appointment.customerExternalId.trim())) {
      return 'Customer recipient is invalid.';
    }

    let appointmentAt: Date;
    try {
      appointmentAt = zonedDateTimeToUtc(appointment.date, appointment.time, config.timezone);
    } catch {
      return 'Appointment date, time or company timezone is invalid.';
    }
    const expected = appointmentAt.getTime() - reminder.offsetMinutes * 60_000;
    if (expected !== reminder.scheduledFor.getTime()) {
      return 'Reminder schedule no longer matches the appointment.';
    }
    if (appointmentAt <= now) return 'Appointment time has already passed.';
    return null;
  }

  private async handleFailure(
    reminder: AppointmentReminderRecord,
    error: unknown,
    now: Date,
  ): Promise<void> {
    const message = operationalError(error);
    if (reminder.attempts >= MAX_ATTEMPTS) {
      await this.repository.markFailed(this.companyId, reminder.id, message, now);
      return;
    }

    const delay = RETRY_DELAYS_MS[reminder.attempts - 1];
    if (delay === undefined) {
      await this.repository.markFailed(this.companyId, reminder.id, message, now);
      return;
    }
    await this.repository.markForRetry(
      this.companyId,
      reminder.id,
      new Date(now.getTime() + delay),
      message,
    );
  }
}

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;

  public constructor(
    private readonly worker: AppointmentReminderWorker,
    private readonly intervalMs = DEFAULT_POLL_INTERVAL_MS,
  ) {}

  public start(): void {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.inFlight;
  }

  private tick(): void {
    if (this.inFlight) return;
    this.inFlight = this.worker.runOnce()
      .catch((error: unknown) => {
        console.error('[Reminder] Falha no ciclo do worker:', operationalError(error));
      })
      .finally(() => {
        this.inFlight = null;
      });
  }
}
