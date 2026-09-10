import {
  Prisma,
  type AppointmentReminder,
  type PrismaClient,
} from '@prisma/client';

import type {
  InterruptedRecoveryResult,
  ReminderRepository,
} from '../reminders/reminder.repository.js';
import type {
  AppointmentReminderRecord,
  EnsureReminderInput,
  ReminderAppointment,
  ReminderCompanyConfig,
  ReminderStatus,
} from '../reminders/reminder.types.js';

const SAFE_RECOVERY_ERROR =
  'Worker restarted before WhatsApp dispatch began; reminder safely requeued.';
const UNCERTAIN_RECOVERY_ERROR =
  'Worker restarted after WhatsApp dispatch began; retry suppressed to prevent duplicate delivery.';

function toRecord(row: AppointmentReminder): AppointmentReminderRecord {
  return {
    ...row,
    status: row.status as ReminderStatus,
  };
}

export class PrismaReminderRepository implements ReminderRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getCompanyConfig(companyId: string): Promise<ReminderCompanyConfig | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        status: true,
        timezone: true,
        settings: {
          select: { remindersEnabled: true, reminderOffsets: true },
        },
        messageTemplates: {
          where: { type: 'REMINDER' },
          select: { body: true },
          take: 1,
        },
      },
    });
    if (!company) return null;

    return {
      id: company.id,
      name: company.name,
      status: company.status,
      timezone: company.timezone,
      remindersEnabled: company.settings?.remindersEnabled ?? false,
      reminderOffsets: company.settings?.reminderOffsets ?? [],
      reminderTemplate: company.messageTemplates[0]?.body ?? null,
    };
  }

  public async listAppointments(companyId: string): Promise<ReminderAppointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: { companyId },
      select: {
        id: true,
        companyId: true,
        customerId: true,
        date: true,
        time: true,
        customer: { select: { externalId: true, name: true } },
      },
    });
    return appointments.map((appointment) => ({
      id: appointment.id,
      companyId: appointment.companyId,
      customerId: appointment.customerId,
      customerExternalId: appointment.customer.externalId,
      customerName: appointment.customer.name,
      date: appointment.date,
      time: appointment.time,
    }));
  }

  public async findAppointment(
    companyId: string,
    appointmentId: string,
  ): Promise<ReminderAppointment | null> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      select: {
        id: true,
        companyId: true,
        customerId: true,
        date: true,
        time: true,
        customer: { select: { externalId: true, name: true } },
      },
    });
    if (!appointment) return null;

    return {
      id: appointment.id,
      companyId: appointment.companyId,
      customerId: appointment.customerId,
      customerExternalId: appointment.customer.externalId,
      customerName: appointment.customer.name,
      date: appointment.date,
      time: appointment.time,
    };
  }

  public async ensureReminder(input: EnsureReminderInput): Promise<void> {
    await this.prisma.appointmentReminder.upsert({
      where: {
        companyId_appointmentId_offsetMinutes_scheduledFor: {
          companyId: input.companyId,
          appointmentId: input.appointmentId,
          offsetMinutes: input.offsetMinutes,
          scheduledFor: input.scheduledFor,
        },
      },
      create: {
        ...input,
        nextAttemptAt: input.scheduledFor,
      },
      update: {},
    });
  }

  public async claimDue(
    companyId: string,
    now: Date,
    limit: number,
  ): Promise<AppointmentReminderRecord[]> {
    const nowUtc = now.toISOString();
    const rows = await this.prisma.$queryRaw<AppointmentReminder[]>(Prisma.sql`
      UPDATE "AppointmentReminder" AS reminder
      SET
        "status" = 'PROCESSING',
        "attempts" = reminder."attempts" + 1,
        "processingStartedAt" = CAST(${nowUtc} AS timestamp(3)),
        "dispatchStartedAt" = NULL,
        "updatedAt" = CAST(${nowUtc} AS timestamp(3))
      WHERE reminder."id" IN (
        SELECT candidate."id"
        FROM "AppointmentReminder" AS candidate
        WHERE candidate."companyId" = ${companyId}
          AND candidate."status" = 'PENDING'
          AND candidate."scheduledFor" <= CAST(${nowUtc} AS timestamp(3))
          AND candidate."nextAttemptAt" <= CAST(${nowUtc} AS timestamp(3))
        ORDER BY candidate."nextAttemptAt" ASC, candidate."scheduledFor" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING reminder.*
    `);
    return rows.map(toRecord);
  }

  public async findReminder(
    companyId: string,
    reminderId: string,
  ): Promise<AppointmentReminderRecord | null> {
    const row = await this.prisma.appointmentReminder.findFirst({
      where: { id: reminderId, companyId },
    });
    return row ? toRecord(row) : null;
  }

  public async markSkipped(
    companyId: string,
    reminderId: string,
    reason: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.appointmentReminder.updateMany({
      where: { id: reminderId, companyId, status: 'PROCESSING' },
      data: {
        status: 'SKIPPED',
        lastError: reason,
        processingStartedAt: null,
        dispatchStartedAt: null,
        nextAttemptAt: now,
      },
    });
    return result.count === 1;
  }

  public async markDispatchStarted(
    companyId: string,
    reminderId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.appointmentReminder.updateMany({
      where: {
        id: reminderId,
        companyId,
        status: 'PROCESSING',
        dispatchStartedAt: null,
      },
      data: { dispatchStartedAt: now },
    });
    return result.count === 1;
  }

  public async markSent(
    companyId: string,
    reminderId: string,
    sentAt: Date,
    providerMessageId: string | null,
  ): Promise<boolean> {
    const result = await this.prisma.appointmentReminder.updateMany({
      where: {
        id: reminderId,
        companyId,
        status: 'PROCESSING',
        dispatchStartedAt: { not: null },
      },
      data: {
        status: 'SENT',
        sentAt,
        providerMessageId,
        lastError: null,
        processingStartedAt: null,
      },
    });
    return result.count === 1;
  }

  public async markForRetry(
    companyId: string,
    reminderId: string,
    nextAttemptAt: Date,
    error: string,
  ): Promise<boolean> {
    const result = await this.prisma.appointmentReminder.updateMany({
      where: { id: reminderId, companyId, status: 'PROCESSING' },
      data: {
        status: 'PENDING',
        nextAttemptAt,
        lastError: error,
        processingStartedAt: null,
        dispatchStartedAt: null,
      },
    });
    return result.count === 1;
  }

  public async markFailed(
    companyId: string,
    reminderId: string,
    error: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.appointmentReminder.updateMany({
      where: { id: reminderId, companyId, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        nextAttemptAt: now,
        lastError: error,
        processingStartedAt: null,
      },
    });
    return result.count === 1;
  }

  public async recoverInterrupted(
    companyId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<InterruptedRecoveryResult> {
    return this.prisma.$transaction(async (transaction) => {
      const safe = await transaction.appointmentReminder.updateMany({
        where: {
          companyId,
          status: 'PROCESSING',
          processingStartedAt: { lte: staleBefore },
          dispatchStartedAt: null,
        },
        data: {
          status: 'PENDING',
          attempts: { decrement: 1 },
          nextAttemptAt: now,
          processingStartedAt: null,
          lastError: SAFE_RECOVERY_ERROR,
        },
      });
      const uncertain = await transaction.appointmentReminder.updateMany({
        where: {
          companyId,
          status: 'PROCESSING',
          processingStartedAt: { lte: staleBefore },
          dispatchStartedAt: { not: null },
        },
        data: {
          status: 'FAILED',
          nextAttemptAt: now,
          processingStartedAt: null,
          lastError: UNCERTAIN_RECOVERY_ERROR,
        },
      });
      return { requeued: safe.count, failed: uncertain.count };
    });
  }
}
