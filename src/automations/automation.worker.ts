import { Prisma, type Automation, type PrismaClient } from '@prisma/client';
import type { ReminderMessenger } from '../reminders/reminder.messenger.js';
import { nextScheduledRun } from './automation.schedule.js';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_STALE_PROCESSING_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const MAX_ERROR_LENGTH = 1000;
const VALID_RECIPIENT = /^[^\s@]+@(c\.us|lid)$/;

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH) || 'Unknown operational error.';
}

export function terminalRunStatus(sent: number, failed: number): 'COMPLETED' | 'PARTIAL' | 'FAILED' {
  return sent > 0 && failed === 0 ? 'COMPLETED' : sent > 0 ? 'PARTIAL' : 'FAILED';
}

export class AutomationWorker {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly messenger: ReminderMessenger,
    private readonly companyId: string,
    private readonly clock: () => Date = () => new Date(),
    private readonly batchSize = DEFAULT_BATCH_SIZE,
    private readonly staleProcessingMs = DEFAULT_STALE_PROCESSING_MS,
  ) {}

  public async runOnce(): Promise<void> {
    const now = this.clock();
    await this.recoverInterrupted(now);
    await this.materializeDueRuns(now);
    const deliveries = await this.claimDeliveries(now);
    for (const delivery of deliveries) await this.dispatch(delivery.id);
    await this.finalizeReadyRuns();
  }

  private async recoverInterrupted(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - this.staleProcessingMs);
    await this.prisma.$transaction([
      this.prisma.automation.updateMany({
        where: { companyId: this.companyId, processingStartedAt: { lte: staleBefore } },
        data: { processingStartedAt: null },
      }),
      this.prisma.automationDelivery.updateMany({
        where: {
          companyId: this.companyId, status: 'PROCESSING', processingStartedAt: { lte: staleBefore }, dispatchStartedAt: null,
        },
        data: {
          status: 'PENDING', attempts: { decrement: 1 }, nextAttemptAt: now,
          processingStartedAt: null, lastError: 'Worker restarted before WhatsApp dispatch began; delivery safely requeued.',
        },
      }),
      this.prisma.automationDelivery.updateMany({
        where: {
          companyId: this.companyId, status: 'PROCESSING', processingStartedAt: { lte: staleBefore }, dispatchStartedAt: { not: null },
        },
        data: {
          status: 'FAILED', processingStartedAt: null,
          lastError: 'Worker restarted after WhatsApp dispatch began; retry suppressed to prevent duplicate delivery.',
        },
      }),
    ]);
  }

  private async materializeDueRuns(now: Date): Promise<void> {
    const nowUtc = now.toISOString();
    const claimed = await this.prisma.$queryRaw<Automation[]>(Prisma.sql`
      UPDATE "Automation" AS automation
      SET
        "processingStartedAt" = CAST(${nowUtc} AS timestamp(3)),
        "updatedAt" = CAST(${nowUtc} AS timestamp(3))
      WHERE automation."id" IN (
        SELECT candidate."id"
        FROM "Automation" AS candidate
        INNER JOIN "Company" AS company ON company."id" = candidate."companyId"
        WHERE candidate."companyId" = ${this.companyId}
          AND candidate."type" = 'SCHEDULED'
          AND candidate."isActive" = true
          AND candidate."deletedAt" IS NULL
          AND candidate."nextRunAt" IS NOT NULL
          AND candidate."nextRunAt" <= CAST(${nowUtc} AS timestamp(3))
          AND candidate."processingStartedAt" IS NULL
          AND company."status" = 'ACTIVE'
        ORDER BY candidate."nextRunAt" ASC, candidate."id" ASC
        FOR UPDATE OF candidate SKIP LOCKED
        LIMIT ${this.batchSize}
      )
      RETURNING automation.*
    `);

    for (const automation of claimed) {
      try {
        await this.createRun(automation, now);
      } catch (error) {
        console.error('[Automation] Falha ao materializar execução:', safeError(error));
      }
    }
  }

  private async createRun(claimed: Automation, now: Date): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const automation = await transaction.automation.findFirst({
        where: {
          id: claimed.id, companyId: this.companyId, type: 'SCHEDULED', isActive: true,
          deletedAt: null, processingStartedAt: { not: null }, nextRunAt: { lte: now }, company: { status: 'ACTIVE' },
        },
        include: { recipients: { include: { customer: true }, orderBy: { createdAt: 'asc' } } },
      });
      if (!automation?.nextRunAt || !automation.messageBody || !automation.scheduleType) return;

      const scheduledFor = automation.nextRunAt;
      const existingRun = await transaction.automationRun.findUnique({
        where: { automationId_scheduleVersion_scheduledFor: {
          automationId: automation.id, scheduleVersion: automation.scheduleVersion, scheduledFor,
        } },
      });

      if (!existingRun) {
        await transaction.automationRun.create({
          data: {
            company: { connect: { id: this.companyId } },
            automation: { connect: { companyId_id: { companyId: this.companyId, id: automation.id } } },
            scheduleVersion: automation.scheduleVersion, scheduledFor,
            status: automation.recipients.length ? 'PROCESSING' : 'FAILED',
            totalRecipients: automation.recipients.length, startedAt: now,
            ...(!automation.recipients.length ? { failedCount: 0, completedAt: now } : {}),
            deliveries: {
              create: automation.recipients.map(({ customer }) => ({
                customer: { connect: { companyId_id: { companyId: this.companyId, id: customer.id } } },
                recipient: customer.externalId, recipientName: customer.name,
                body: automation.messageBody!, nextAttemptAt: now,
              })),
            },
          },
        });
      }

      const after = scheduledFor > now ? scheduledFor : now;
      const nextRunAt = automation.scheduleType === 'WEEKLY'
        ? nextScheduledRun({
            scheduleType: 'WEEKLY', weekdays: automation.weekdays,
            times: automation.times,
          }, automation.companyId === this.companyId
            ? (await transaction.company.findUnique({ where: { id: this.companyId }, select: { timezone: true } }))!.timezone
            : 'UTC', after)
        : null;
      await transaction.automation.update({
        where: { companyId_id: { companyId: this.companyId, id: automation.id } },
        data: { nextRunAt, processingStartedAt: null },
      });
    });
  }

  private claimDeliveries(now: Date): Promise<Array<{ id: string }>> {
    const nowUtc = now.toISOString();
    return this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "AutomationDelivery" AS delivery
      SET
        "status" = 'PROCESSING',
        "attempts" = delivery."attempts" + 1,
        "processingStartedAt" = CAST(${nowUtc} AS timestamp(3)),
        "dispatchStartedAt" = NULL,
        "updatedAt" = CAST(${nowUtc} AS timestamp(3))
      WHERE delivery."id" IN (
        SELECT candidate."id"
        FROM "AutomationDelivery" AS candidate
        WHERE candidate."companyId" = ${this.companyId}
          AND candidate."status" = 'PENDING'
          AND candidate."nextAttemptAt" <= CAST(${nowUtc} AS timestamp(3))
        ORDER BY candidate."nextAttemptAt" ASC, candidate."id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${this.batchSize}
      )
      RETURNING delivery."id"
    `);
  }

  private async dispatch(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.automationDelivery.findFirst({
      where: { id: deliveryId, companyId: this.companyId },
      include: { run: { include: { automation: true, company: true } } },
    });
    if (!delivery || delivery.status !== 'PROCESSING') return;
    const now = this.clock();
    const reason = delivery.run.scheduleVersion !== delivery.run.automation.scheduleVersion
      ? 'Automation schedule was changed after this run was created.'
      : !delivery.run.automation.isActive || delivery.run.automation.deletedAt
      ? 'Automation is inactive.'
      : delivery.run.company.status !== 'ACTIVE'
        ? 'Company is inactive.'
        : !VALID_RECIPIENT.test(delivery.recipient.trim())
          ? 'Customer recipient is invalid.'
          : null;
    if (reason) {
      await this.prisma.automationDelivery.updateMany({
        where: { id: delivery.id, companyId: this.companyId, status: 'PROCESSING' },
        data: { status: 'SKIPPED', lastError: reason, processingStartedAt: null, dispatchStartedAt: null },
      });
      await this.refreshRun(delivery.runId);
      return;
    }

    if (!(await this.messenger.isReady(this.companyId))) {
      await this.handleFailure(delivery, new Error('WhatsApp channel is not ready.'), now);
      return;
    }
    const started = await this.prisma.automationDelivery.updateMany({
      where: { id: delivery.id, companyId: this.companyId, status: 'PROCESSING', dispatchStartedAt: null },
      data: { dispatchStartedAt: now },
    });
    if (started.count !== 1) return;

    try {
      const result = await this.messenger.sendReminder(this.companyId, delivery.recipient, delivery.body);
      await this.prisma.automationDelivery.updateMany({
        where: { id: delivery.id, companyId: this.companyId, status: 'PROCESSING', dispatchStartedAt: { not: null } },
        data: {
          status: 'SENT', sentAt: this.clock(), providerMessageId: result.messageId,
          lastError: null, processingStartedAt: null,
        },
      });
      await this.refreshRun(delivery.runId);
    } catch (error) {
      await this.handleFailure(delivery, error, this.clock());
    }
  }

  private async handleFailure(
    delivery: { id: string; runId: string; attempts: number },
    error: unknown,
    now: Date,
  ): Promise<void> {
    const message = safeError(error);
    const delay = RETRY_DELAYS_MS[delivery.attempts - 1];
    if (delivery.attempts < MAX_ATTEMPTS && delay !== undefined) {
      await this.prisma.automationDelivery.updateMany({
        where: { id: delivery.id, companyId: this.companyId, status: 'PROCESSING' },
        data: {
          status: 'PENDING', nextAttemptAt: new Date(now.getTime() + delay), lastError: message,
          processingStartedAt: null, dispatchStartedAt: null,
        },
      });
      return;
    }
    await this.prisma.automationDelivery.updateMany({
      where: { id: delivery.id, companyId: this.companyId, status: 'PROCESSING' },
      data: { status: 'FAILED', lastError: message, processingStartedAt: null },
    });
    await this.refreshRun(delivery.runId);
  }

  private async finalizeReadyRuns(): Promise<void> {
    const runs = await this.prisma.automationRun.findMany({
      where: { companyId: this.companyId, status: { in: ['PENDING', 'PROCESSING'] } }, select: { id: true },
    });
    for (const run of runs) await this.refreshRun(run.id);
  }

  private async refreshRun(runId: string): Promise<void> {
    const grouped = await this.prisma.automationDelivery.groupBy({
      by: ['status'], where: { companyId: this.companyId, runId }, _count: { _all: true },
    });
    const count = (status: string): number => grouped.find((row) => row.status === status)?._count._all ?? 0;
    const pending = count('PENDING') + count('PROCESSING');
    if (pending) return;
    const sent = count('SENT');
    const failed = count('FAILED') + count('SKIPPED');
    const status = terminalRunStatus(sent, failed);
    await this.prisma.automationRun.updateMany({
      where: { id: runId, companyId: this.companyId, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status, sentCount: sent, failedCount: failed, completedAt: this.clock() },
    });
  }
}

export class AutomationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;

  public constructor(private readonly worker: AutomationWorker, private readonly intervalMs = 30_000) {}

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
      .catch((error: unknown) => console.error('[Automation] Falha no ciclo do worker:', safeError(error)))
      .finally(() => { this.inFlight = null; });
  }
}
