import assert from 'node:assert/strict';
import test from 'node:test';

import type { ReminderMessenger, ReminderSendResult } from './reminder.messenger.js';
import type {
  InterruptedRecoveryResult,
  ReminderRepository,
} from './reminder.repository.js';
import type {
  AppointmentReminderRecord,
  EnsureReminderInput,
  ReminderAppointment,
  ReminderCompanyConfig,
} from './reminder.types.js';
import { AppointmentReminderWorker } from './reminder.worker.js';

function cloneReminder(value: AppointmentReminderRecord): AppointmentReminderRecord {
  return {
    ...value,
    scheduledFor: new Date(value.scheduledFor),
    nextAttemptAt: new Date(value.nextAttemptAt),
    processingStartedAt: value.processingStartedAt ? new Date(value.processingStartedAt) : null,
    dispatchStartedAt: value.dispatchStartedAt ? new Date(value.dispatchStartedAt) : null,
    sentAt: value.sentAt ? new Date(value.sentAt) : null,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
  };
}

class MemoryReminderRepository implements ReminderRepository {
  public readonly companies = new Map<string, ReminderCompanyConfig>();
  public readonly appointments = new Map<string, ReminderAppointment>();
  public readonly reminders = new Map<string, AppointmentReminderRecord>();
  private nextId = 1;

  public async getCompanyConfig(companyId: string): Promise<ReminderCompanyConfig | null> {
    const config = this.companies.get(companyId);
    return config ? { ...config, reminderOffsets: [...config.reminderOffsets] } : null;
  }

  public async listAppointments(companyId: string): Promise<ReminderAppointment[]> {
    return [...this.appointments.values()]
      .filter((appointment) => appointment.companyId === companyId)
      .map((appointment) => ({ ...appointment }));
  }

  public async findAppointment(companyId: string, appointmentId: string): Promise<ReminderAppointment | null> {
    const appointment = this.appointments.get(`${companyId}:${appointmentId}`);
    return appointment ? { ...appointment } : null;
  }

  public async ensureReminder(input: EnsureReminderInput): Promise<void> {
    const existing = [...this.reminders.values()].find((reminder) =>
      reminder.companyId === input.companyId &&
      reminder.appointmentId === input.appointmentId &&
      reminder.offsetMinutes === input.offsetMinutes &&
      reminder.scheduledFor.getTime() === input.scheduledFor.getTime());
    if (existing) return;

    const now = new Date('2029-01-01T00:00:00.000Z');
    const id = `reminder-${this.nextId++}`;
    this.reminders.set(id, {
      id,
      ...input,
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(input.scheduledFor),
      processingStartedAt: null,
      dispatchStartedAt: null,
      sentAt: null,
      providerMessageId: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public async claimDue(companyId: string, now: Date, limit: number): Promise<AppointmentReminderRecord[]> {
    const due = [...this.reminders.values()]
      .filter((reminder) =>
        reminder.companyId === companyId &&
        reminder.status === 'PENDING' &&
        reminder.scheduledFor <= now &&
        reminder.nextAttemptAt <= now)
      .sort((left, right) => left.nextAttemptAt.getTime() - right.nextAttemptAt.getTime())
      .slice(0, limit);
    for (const reminder of due) {
      reminder.status = 'PROCESSING';
      reminder.attempts += 1;
      reminder.processingStartedAt = new Date(now);
      reminder.dispatchStartedAt = null;
      reminder.updatedAt = new Date(now);
    }
    return due.map(cloneReminder);
  }

  public async findReminder(companyId: string, reminderId: string): Promise<AppointmentReminderRecord | null> {
    const reminder = this.reminders.get(reminderId);
    return reminder?.companyId === companyId ? cloneReminder(reminder) : null;
  }

  public async markSkipped(companyId: string, reminderId: string, reason: string, now: Date): Promise<boolean> {
    return this.updateProcessing(companyId, reminderId, (reminder) => {
      reminder.status = 'SKIPPED';
      reminder.lastError = reason;
      reminder.nextAttemptAt = new Date(now);
      reminder.processingStartedAt = null;
      reminder.dispatchStartedAt = null;
    });
  }

  public async markDispatchStarted(companyId: string, reminderId: string, now: Date): Promise<boolean> {
    return this.updateProcessing(companyId, reminderId, (reminder) => {
      if (reminder.dispatchStartedAt) throw new Error('dispatch already started');
      reminder.dispatchStartedAt = new Date(now);
    });
  }

  public async markSent(companyId: string, reminderId: string, sentAt: Date, providerMessageId: string | null): Promise<boolean> {
    return this.updateProcessing(companyId, reminderId, (reminder) => {
      if (!reminder.dispatchStartedAt) throw new Error('dispatch not started');
      reminder.status = 'SENT';
      reminder.sentAt = new Date(sentAt);
      reminder.providerMessageId = providerMessageId;
      reminder.lastError = null;
      reminder.processingStartedAt = null;
    });
  }

  public async markForRetry(companyId: string, reminderId: string, nextAttemptAt: Date, error: string): Promise<boolean> {
    return this.updateProcessing(companyId, reminderId, (reminder) => {
      reminder.status = 'PENDING';
      reminder.nextAttemptAt = new Date(nextAttemptAt);
      reminder.lastError = error;
      reminder.processingStartedAt = null;
      reminder.dispatchStartedAt = null;
    });
  }

  public async markFailed(companyId: string, reminderId: string, error: string, now: Date): Promise<boolean> {
    return this.updateProcessing(companyId, reminderId, (reminder) => {
      reminder.status = 'FAILED';
      reminder.nextAttemptAt = new Date(now);
      reminder.lastError = error;
      reminder.processingStartedAt = null;
    });
  }

  public async recoverInterrupted(companyId: string, staleBefore: Date, now: Date): Promise<InterruptedRecoveryResult> {
    let requeued = 0;
    let failed = 0;
    for (const reminder of this.reminders.values()) {
      if (
        reminder.companyId !== companyId ||
        reminder.status !== 'PROCESSING' ||
        !reminder.processingStartedAt ||
        reminder.processingStartedAt > staleBefore
      ) continue;
      if (reminder.dispatchStartedAt) {
        reminder.status = 'FAILED';
        reminder.lastError = 'uncertain dispatch; retry suppressed';
        failed += 1;
      } else {
        reminder.status = 'PENDING';
        reminder.attempts -= 1;
        reminder.nextAttemptAt = new Date(now);
        reminder.lastError = 'safe restart recovery';
        requeued += 1;
      }
      reminder.processingStartedAt = null;
    }
    return { requeued, failed };
  }

  private updateProcessing(
    companyId: string,
    reminderId: string,
    update: (reminder: AppointmentReminderRecord) => void,
  ): boolean {
    const reminder = this.reminders.get(reminderId);
    if (!reminder || reminder.companyId !== companyId || reminder.status !== 'PROCESSING') return false;
    update(reminder);
    return true;
  }
}

interface SentMessage {
  companyId: string;
  recipient: string;
  body: string;
}

class FakeMessenger implements ReminderMessenger {
  public readonly readyCompanies = new Set<string>();
  public readonly sent: SentMessage[] = [];
  public failuresRemaining = 0;

  public isReady(companyId: string): boolean {
    return this.readyCompanies.has(companyId);
  }

  public async sendReminder(companyId: string, recipient: string, body: string): Promise<ReminderSendResult> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('temporary WhatsApp failure');
    }
    this.sent.push({ companyId, recipient, body });
    return { messageId: `message-${this.sent.length}` };
  }
}

interface Harness {
  repository: MemoryReminderRepository;
  messenger: FakeMessenger;
  worker: AppointmentReminderWorker;
  setNow(value: string): void;
}

function createHarness(
  offsets: number[] = [30],
  options: { companyId?: string; timezone?: string; template?: string | null } = {},
): Harness {
  const companyId = options.companyId ?? 'company-a';
  let now = new Date('2030-01-01T00:00:00.000Z');
  const repository = new MemoryReminderRepository();
  repository.companies.set(companyId, {
    id: companyId,
    name: companyId === 'company-a' ? 'Empresa A' : 'Empresa B',
    status: 'ACTIVE',
    timezone: options.timezone ?? 'UTC',
    remindersEnabled: true,
    reminderOffsets: offsets,
    reminderTemplate: options.template ?? null,
  });
  repository.appointments.set(`${companyId}:appointment-1`, {
    id: 'appointment-1',
    companyId,
    customerId: 'customer-1',
    customerExternalId: '5511999999999@c.us',
    customerName: 'Samuel',
    date: '2030-01-03',
    time: '12:00',
  });
  const messenger = new FakeMessenger();
  messenger.readyCompanies.add(companyId);
  return {
    repository,
    messenger,
    worker: new AppointmentReminderWorker(repository, messenger, companyId, () => new Date(now)),
    setNow(value: string) { now = new Date(value); },
  };
}

async function scheduleAndReachOffset(harness: Harness, offsetMinutes: number): Promise<void> {
  await harness.worker.runOnce();
  harness.setNow(new Date(Date.parse('2030-01-03T12:00:00.000Z') - offsetMinutes * 60_000).toISOString());
  await harness.worker.runOnce();
}

for (const [offset, label] of [[1440, '24h'], [720, '12h'], [240, '4h'], [60, '1h'], [30, '30min']] as const) {
  test(`sends the ${label} reminder preset`, async () => {
    const harness = createHarness([offset]);
    await scheduleAndReachOffset(harness, offset);
    assert.equal(harness.messenger.sent.length, 1);
    assert.equal([...harness.repository.reminders.values()][0]?.status, 'SENT');
  });
}

test('persists multiple offsets and creates none when no offset is selected', async () => {
  const multiple = createHarness([1440, 60, 30]);
  await multiple.worker.runOnce();
  assert.deepEqual([...multiple.repository.reminders.values()].map(value=>value.offsetMinutes).sort((a,b)=>b-a),[1440,60,30]);

  const none = createHarness([]);
  await none.worker.runOnce();
  assert.equal(none.repository.reminders.size, 0);
});

test('renders a custom reminder template using the allowlisted variables', async () => {
  const harness = createHarness([30], { template: 'Oi {{customerName}}! {{companyName}}: {{date}} às {{time}}.' });
  await scheduleAndReachOffset(harness, 30);
  assert.equal(harness.messenger.sent[0]?.body, 'Oi Samuel! Empresa A: 03/01/2030 às 12:00.');
});

test('falls back to the platform reminder template', async () => {
  const harness = createHarness([30]);
  await scheduleAndReachOffset(harness, 30);
  assert.match(harness.messenger.sent[0]?.body ?? '', /Olá, Samuel!/);
  assert.match(harness.messenger.sent[0]?.body ?? '', /Empresa A/);
});

test('skips a persisted reminder after appointment cancellation', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  harness.repository.appointments.delete('company-a:appointment-1');
  harness.setNow('2030-01-03T11:30:00.000Z');
  await harness.worker.runOnce();
  assert.equal(harness.messenger.sent.length, 0);
  assert.equal([...harness.repository.reminders.values()][0]?.status, 'SKIPPED');
});

test('invalidates the old reminder and schedules the new time after rescheduling', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  const appointment = harness.repository.appointments.get('company-a:appointment-1')!;
  appointment.time = '14:00';
  await harness.worker.runOnce();
  assert.equal(harness.repository.reminders.size, 2);
  harness.setNow('2030-01-03T11:30:00.000Z');
  await harness.worker.runOnce();
  const oldReminder = [...harness.repository.reminders.values()].find(value=>value.appointmentTime==='12:00');
  assert.equal(oldReminder?.status, 'SKIPPED');
  assert.equal(harness.messenger.sent.length, 0);
});

test('skips due reminders for an inactive company', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  harness.repository.companies.get('company-a')!.status = 'INACTIVE';
  harness.setNow('2030-01-03T11:30:00.000Z');
  await harness.worker.runOnce();
  assert.equal(harness.messenger.sent.length, 0);
  assert.equal([...harness.repository.reminders.values()][0]?.status, 'SKIPPED');
});

test('skips a reminder when its offset is removed after scheduling', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  harness.repository.companies.get('company-a')!.reminderOffsets = [];
  harness.setNow('2030-01-03T11:30:00.000Z');
  await harness.worker.runOnce();
  assert.equal(harness.messenger.sent.length, 0);
  assert.match([...harness.repository.reminders.values()][0]?.lastError ?? '', /no longer enabled/);
});

test('an appointment created 30 minutes away does not catch up older offsets', async () => {
  const harness = createHarness([1440, 60, 30]);
  harness.repository.appointments.get('company-a:appointment-1')!.date = '2030-01-01';
  harness.repository.appointments.get('company-a:appointment-1')!.time = '00:30';
  await harness.worker.runOnce();
  assert.equal(harness.repository.reminders.size, 1);
  assert.equal([...harness.repository.reminders.values()][0]?.offsetMinutes, 30);
  assert.equal(harness.messenger.sent.length, 1);
});

test('restart keeps persistent scheduling and does not resend SENT reminders', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:30:00.000Z');
  const restarted = new AppointmentReminderWorker(
    harness.repository,
    harness.messenger,
    'company-a',
    () => new Date('2030-01-03T11:30:00.000Z'),
  );
  await restarted.runOnce();
  await restarted.runOnce();
  assert.equal(harness.messenger.sent.length, 1);
  assert.equal(harness.repository.reminders.size, 1);
});

test('restart requeues a safe claim but suppresses an uncertain dispatch', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  const due = new Date('2030-01-03T11:30:00.000Z');
  const [safeClaim] = await harness.repository.claimDue('company-a', due, 1);
  assert.ok(safeClaim);
  const safeRestart = new AppointmentReminderWorker(harness.repository,harness.messenger,'company-a',()=>due,{staleProcessingMs:0});
  await safeRestart.runOnce();
  assert.equal(harness.messenger.sent.length,1);

  const uncertainHarness = createHarness([30]);
  await uncertainHarness.worker.runOnce();
  const [uncertainClaim] = await uncertainHarness.repository.claimDue('company-a', due, 1);
  assert.ok(uncertainClaim);
  await uncertainHarness.repository.markDispatchStarted('company-a',uncertainClaim.id,due);
  const uncertainRestart = new AppointmentReminderWorker(uncertainHarness.repository,uncertainHarness.messenger,'company-a',()=>due,{staleProcessingMs:0});
  await uncertainRestart.runOnce();
  assert.equal(uncertainHarness.messenger.sent.length,0);
  assert.equal([...uncertainHarness.repository.reminders.values()][0]?.status,'FAILED');
});

test('retries transient WhatsApp failures with controlled backoff and succeeds on attempt three', async () => {
  const harness = createHarness([30]);
  harness.messenger.failuresRemaining = 2;
  await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:30:00.000Z');
  await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:31:00.000Z');
  await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:36:00.000Z');
  await harness.worker.runOnce();
  const reminder = [...harness.repository.reminders.values()][0]!;
  assert.equal(reminder.status, 'SENT');
  assert.equal(reminder.attempts, 3);
  assert.equal(harness.messenger.sent.length, 1);
});

test('idempotency prevents duplicate records and duplicate delivery', async () => {
  const harness = createHarness([30]);
  await harness.worker.runOnce();
  await harness.worker.runOnce();
  assert.equal(harness.repository.reminders.size, 1);
  harness.setNow('2030-01-03T11:30:00.000Z');
  await harness.worker.runOnce();
  await harness.worker.runOnce();
  assert.equal(harness.messenger.sent.length, 1);
});

test('workers preserve Company A and Company B isolation', async () => {
  let now = new Date('2030-01-01T00:00:00.000Z');
  const repository = new MemoryReminderRepository();
  const messenger = new FakeMessenger();
  for (const companyId of ['company-a','company-b']) {
    repository.companies.set(companyId,{id:companyId,name:companyId,status:'ACTIVE',timezone:'UTC',remindersEnabled:true,reminderOffsets:[30],reminderTemplate:`${companyId} {{customerName}}`});
    repository.appointments.set(`${companyId}:appointment-1`,{id:'appointment-1',companyId,customerId:`customer-${companyId}`,customerExternalId:`${companyId}@c.us`,customerName:companyId,date:'2030-01-03',time:'12:00'});
    messenger.readyCompanies.add(companyId);
  }
  const workerA=new AppointmentReminderWorker(repository,messenger,'company-a',()=>new Date(now));
  const workerB=new AppointmentReminderWorker(repository,messenger,'company-b',()=>new Date(now));
  await workerA.runOnce();await workerB.runOnce();
  now=new Date('2030-01-03T11:30:00.000Z');
  await workerA.runOnce();
  assert.deepEqual(messenger.sent.map(sent=>sent.companyId),['company-a']);
  await workerB.runOnce();
  assert.deepEqual(messenger.sent.map(sent=>sent.companyId),['company-a','company-b']);
  assert.equal(messenger.sent[0]?.recipient,'company-a@c.us');
  assert.equal(messenger.sent[1]?.recipient,'company-b@c.us');
});

test('calculates scheduledFor from the company IANA timezone and persists UTC', async () => {
  const harness = createHarness([30], { timezone: 'America/Sao_Paulo' });
  await harness.worker.runOnce();
  assert.equal([...harness.repository.reminders.values()][0]?.scheduledFor.toISOString(),'2030-01-03T14:30:00.000Z');
});

test('a persistent WhatsApp failure reaches FAILED after the bounded attempts', async () => {
  const harness = createHarness([30]);
  harness.messenger.failuresRemaining = 3;
  await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:30:00.000Z');await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:31:00.000Z');await harness.worker.runOnce();
  harness.setNow('2030-01-03T11:36:00.000Z');await harness.worker.runOnce();
  const reminder=[...harness.repository.reminders.values()][0]!;
  assert.equal(reminder.status,'FAILED');
  assert.equal(reminder.attempts,3);
  assert.match(reminder.lastError??'',/temporary WhatsApp failure/);
  assert.equal(harness.messenger.sent.length,0);
});
