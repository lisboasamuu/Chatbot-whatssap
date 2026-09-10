import assert from 'node:assert/strict';
import test from 'node:test';

import { AppointmentService } from '../appointments/appointment.service.js';
import {
  AppointmentSlotUnavailableError,
  type AppointmentStore,
} from '../appointments/appointment.store.js';
import type {
  Appointment,
  CreateAppointmentInput,
} from '../appointments/appointment.types.js';
import {
  ConversationEngine,
  DEFAULT_REPLY,
  FALLBACK_REPLY,
  INACTIVITY_REPLY,
} from './conversation.engine.js';
import type {
  ConversationStore,
  SaveMessageInput,
  UpdateSessionInput,
} from './conversation.store.js';
import type {
  ConversationContext,
  ConversationSession,
  ConversationState,
} from './conversation.types.js';

const NOW = () => new Date('2030-01-01T10:00:00');

class InMemoryConversationStore implements ConversationStore {
  private readonly sessionsByUser = new Map<string, ConversationSession>();
  public readonly messages: SaveMessageInput[] = [];

  public async getOrCreateSession(
    externalUserId: string,
  ): Promise<ConversationSession> {
    const existing = this.sessionsByUser.get(externalUserId);
    if (existing) {
      return this.cloneSession(existing);
    }

    const session: ConversationSession = {
      id: `conversation-${externalUserId}`,
      customerId: `customer-${externalUserId}`,
      state: 'INITIAL',
      context: null,
    };
    this.sessionsByUser.set(externalUserId, session);
    return this.cloneSession(session);
  }

  public async updateSession(
    conversationId: string,
    input: UpdateSessionInput,
  ): Promise<void> {
    for (const [userId, session] of this.sessionsByUser) {
      if (session.id === conversationId) {
        this.sessionsByUser.set(userId, {
          ...session,
          state: input.state,
          context: input.context ? { ...input.context } : null,
        });
        return;
      }
    }

    throw new Error('conversation not found');
  }

  public async updateState(
    conversationId: string,
    state: ConversationState,
  ): Promise<void> {
    for (const [userId, session] of this.sessionsByUser) {
      if (session.id === conversationId) {
        this.sessionsByUser.set(userId, { ...session, state });
        return;
      }
    }

    throw new Error('conversation not found');
  }

  public async saveMessage(input: SaveMessageInput): Promise<void> {
    this.messages.push({ ...input });
  }

  public stateFor(externalUserId: string): ConversationState {
    return this.sessionsByUser.get(externalUserId)?.state ?? 'INITIAL';
  }

  public contextFor(externalUserId: string): ConversationContext | null {
    const context = this.sessionsByUser.get(externalUserId)?.context;
    return context ? { ...context } : null;
  }

  public customerFor(externalUserId: string): string {
    return `customer-${externalUserId}`;
  }

  public seedSession(
    externalUserId: string,
    state: ConversationState,
    context: ConversationContext | null,
  ): void {
    this.sessionsByUser.set(externalUserId, {
      id: `conversation-${externalUserId}`,
      customerId: this.customerFor(externalUserId),
      state,
      context: context ? { ...context } : null,
    });
  }

  private cloneSession(session: ConversationSession): ConversationSession {
    return {
      ...session,
      context: session.context ? { ...session.context } : null,
    };
  }
}

class InMemoryAppointmentStore implements AppointmentStore {
  private readonly appointments = new Map<string, Appointment>();
  private readonly customerNames = new Map<string, string>();
  private sequence = 0;

  public async create(input: CreateAppointmentInput): Promise<Appointment> {
    this.assertSlotAvailable(input.date, input.time);
    this.customerNames.set(input.customerId, input.customerName);

    const now = NOW();
    const appointment: Appointment = {
      id: `appointment-${++this.sequence}`,
      customerId: input.customerId,
      date: input.date,
      time: input.time,
      createdAt: now,
      updatedAt: now,
    };

    this.appointments.set(appointment.id, appointment);
    return this.clone(appointment);
  }

  public async listByCustomer(customerId: string): Promise<Appointment[]> {
    return [...this.appointments.values()]
      .filter((appointment) => appointment.customerId === customerId)
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.time.localeCompare(right.time),
      )
      .map((appointment) => this.clone(appointment));
  }

  public async deleteForCustomer(
    appointmentId: string,
    customerId: string,
  ): Promise<boolean> {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment || appointment.customerId !== customerId) {
      return false;
    }

    this.appointments.delete(appointmentId);
    return true;
  }

  public async rescheduleForCustomer(
    appointmentId: string,
    customerId: string,
    date: string,
    time: string,
  ): Promise<Appointment | null> {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment || appointment.customerId !== customerId) {
      return null;
    }

    this.assertSlotAvailable(date, time, appointmentId);

    const updated: Appointment = {
      ...appointment,
      date,
      time,
      updatedAt: new Date(appointment.updatedAt.getTime() + 1),
    };
    this.appointments.set(appointmentId, updated);
    return this.clone(updated);
  }

  public seed(
    customerId: string,
    date: string,
    time: string,
    id?: string,
  ): Appointment {
    this.assertSlotAvailable(date, time);
    const appointmentId = id ?? `appointment-${++this.sequence}`;
    const appointment: Appointment = {
      id: appointmentId,
      customerId,
      date,
      time,
      createdAt: NOW(),
      updatedAt: NOW(),
    };
    this.appointments.set(appointmentId, appointment);
    return this.clone(appointment);
  }

  public get(id: string): Appointment | undefined {
    const appointment = this.appointments.get(id);
    return appointment ? this.clone(appointment) : undefined;
  }

  public count(): number {
    return this.appointments.size;
  }

  public customerNameFor(customerId: string): string | undefined {
    return this.customerNames.get(customerId);
  }

  private assertSlotAvailable(
    date: string,
    time: string,
    ignoredAppointmentId?: string,
  ): void {
    const conflict = [...this.appointments.values()].some(
      (appointment) =>
        appointment.id !== ignoredAppointmentId &&
        appointment.date === date &&
        appointment.time === time,
    );

    if (conflict) {
      throw new AppointmentSlotUnavailableError();
    }
  }

  private clone(appointment: Appointment): Appointment {
    return {
      ...appointment,
      createdAt: new Date(appointment.createdAt),
      updatedAt: new Date(appointment.updatedAt),
    };
  }
}

interface TestHarness {
  conversationStore: InMemoryConversationStore;
  appointmentStore: InMemoryAppointmentStore;
  appointmentService: AppointmentService;
  engine: ConversationEngine;
}

function createHarness(): TestHarness {
  const conversationStore = new InMemoryConversationStore();
  const appointmentStore = new InMemoryAppointmentStore();
  const appointmentService = new AppointmentService(appointmentStore, NOW);
  const engine = new ConversationEngine(
    conversationStore,
    appointmentService,
  );

  return {
    conversationStore,
    appointmentStore,
    appointmentService,
    engine,
  };
}

async function activate(
  engine: ConversationEngine,
  user = 'user-a',
): Promise<void> {
  await engine.handle({ conversationId: user, text: 'Olá', type: 'text' });
}

async function advanceToSchedulingConfirmation(
  engine: ConversationEngine,
  user = 'user-a',
  date = '02/01/2030',
  time = '14:30',
  name = 'João Silva',
): Promise<void> {
  await engine.handle({ conversationId: user, text: 'agendar' });
  await engine.handle({ conversationId: user, text: date });
  await engine.handle({ conversationId: user, text: time });
  await engine.handle({ conversationId: user, text: name });
}

async function schedule(
  engine: ConversationEngine,
  user = 'user-a',
  date = '02/01/2030',
  time = '14:30',
): Promise<void> {
  await advanceToSchedulingConfirmation(engine, user, date, time);
  await engine.handle({ conversationId: user, text: 'sim' });
}

test('starts a new conversation and transitions INITIAL to ACTIVE for a normal message', async () => {
  const { conversationStore, engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'Olá',
    type: 'text',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
  assert.equal(conversationStore.stateFor('user-a'), 'ACTIVE');
});

test('processes an unambiguous scheduling command on the first interaction', async () => {
  const { conversationStore, engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '  AGENDAR  ',
  });

  assert.equal(result.state, 'SCHEDULING_DATE');
  assert.match(result.reply, /Qual data/);
  assert.equal(conversationStore.stateFor('user-a'), 'SCHEDULING_DATE');
});

test('keeps an existing conversation ACTIVE and shows menu for unknown text', async () => {
  const { engine } = createHarness();

  await activate(engine);
  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'Segunda mensagem sem comando',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
});

test('keeps conversation state isolated by conversationId', async () => {
  const { conversationStore, engine } = createHarness();

  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  const userBResult = await engine.handle({
    conversationId: 'user-b',
    text: '   ',
  });

  assert.equal(conversationStore.stateFor('user-a'), 'SCHEDULING_DATE');
  assert.equal(conversationStore.stateFor('user-b'), 'INITIAL');
  assert.equal(userBResult.state, 'INITIAL');
});

test('returns fallback for empty text without advancing state and persists inbound', async () => {
  const { conversationStore, engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '   ',
    type: 'text',
  });

  assert.equal(result.reply, FALLBACK_REPLY);
  assert.equal(result.state, 'INITIAL');
  assert.equal(conversationStore.messages.length, 1);
  assert.equal(conversationStore.messages[0]?.direction, 'INBOUND');
});

test('returns fallback for unsupported message type without advancing state', async () => {
  const { engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '',
    type: 'unsupported',
  });

  assert.equal(result.reply, FALLBACK_REPLY);
  assert.equal(result.state, 'INITIAL');
});

test('records outbound only when explicitly confirmed by caller', async () => {
  const { conversationStore, engine } = createHarness();
  const result = await engine.handle({ conversationId: 'user-a', text: 'Olá' });

  assert.equal(conversationStore.messages.length, 1);
  await engine.recordOutbound(result.conversationId, result.reply);
  assert.equal(conversationStore.messages.length, 2);
  assert.equal(conversationStore.messages[1]?.direction, 'OUTBOUND');
});

test('propagates conversation persistence errors to the integration boundary', async () => {
  const { conversationStore, engine } = createHarness();
  conversationStore.getOrCreateSession = async () => {
    throw new Error('database unavailable');
  };

  await assert.rejects(
    engine.handle({ conversationId: 'user-a', text: 'Olá' }),
    /database unavailable/,
  );
});

test('CREATE: agendar starts the scheduling flow', async () => {
  const { engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'agendar',
  });

  assert.equal(result.state, 'SCHEDULING_DATE');
  assert.equal(
    result.reply,
    'Qual data você deseja? Envie no formato DD/MM/AAAA.',
  );
});

test('CREATE: valid date advances and persists normalized draftDate', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '02/01/2030',
  });

  assert.equal(result.state, 'SCHEDULING_TIME');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
  });
});

test('CREATE: invalid calendar date does not advance', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '31/02/2030',
  });

  assert.equal(result.state, 'SCHEDULING_DATE');
  assert.equal(result.reply, 'Data inválida. Envie no formato DD/MM/AAAA.');
  assert.equal(conversationStore.contextFor('user-a'), null);
});

test('CREATE: leap year validation accepts 29/02 only on a leap year', async () => {
  const { engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });

  const invalid = await engine.handle({
    conversationId: 'user-a',
    text: '29/02/2031',
  });
  assert.equal(invalid.state, 'SCHEDULING_DATE');

  const valid = await engine.handle({
    conversationId: 'user-a',
    text: '29/02/2032',
  });
  assert.equal(valid.state, 'SCHEDULING_TIME');
});

test('CREATE: valid time advances and persists draftTime', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '14:30',
  });

  assert.equal(result.state, 'SCHEDULING_NAME');
  assert.equal(result.reply, 'Qual é o seu nome?');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
    draftTime: '14:30',
  });
});

test('CREATE: valid name advances to confirmation and persists draftName', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });
  await engine.handle({ conversationId: 'user-a', text: '14:30' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '  João   da Silva  ',
  });

  assert.equal(result.state, 'SCHEDULING_CONFIRMATION');
  assert.match(result.reply, /João da Silva/);
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
    draftTime: '14:30',
    draftName: 'João da Silva',
  });
});

test('CREATE: invalid name remains in name step', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });
  await engine.handle({ conversationId: 'user-a', text: '14:30' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '12345',
  });

  assert.equal(result.state, 'SCHEDULING_NAME');
  assert.match(result.reply, /Nome inválido/);
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
    draftTime: '14:30',
  });
});

test('CREATE: invalid time does not advance', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '25:80',
  });

  assert.equal(result.state, 'SCHEDULING_TIME');
  assert.equal(result.reply, 'Horário inválido. Envie no formato HH:mm.');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
  });
});

test('CREATE: past date and past time are rejected with controlled state', async () => {
  const { engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });

  const pastDate = await engine.handle({
    conversationId: 'user-a',
    text: '31/12/2029',
  });
  assert.equal(pastDate.state, 'SCHEDULING_DATE');

  await engine.handle({ conversationId: 'user-a', text: '01/01/2030' });
  const pastTime = await engine.handle({
    conversationId: 'user-a',
    text: '09:59',
  });
  assert.equal(pastTime.state, 'SCHEDULING_TIME');
  assert.match(pastTime.reply, /futuro/);
});

test('CREATE: affirmative confirmation creates appointment and clears context', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  await advanceToSchedulingConfirmation(engine);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sim',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(
    result.reply,
    'Agendamento confirmado para 02/01/2030 às 14:30. Obrigado pela preferência!',
  );
  assert.equal(appointmentStore.count(), 1);
  assert.equal(
    appointmentStore.customerNameFor(conversationStore.customerFor('user-a')),
    'João Silva',
  );
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    awaitingCourtesyReply: true,
  });
});

test('CREATE: negative confirmation cancels flow without creating appointment', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  await advanceToSchedulingConfirmation(engine);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'não',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Agendamento não realizado.');
  assert.equal(appointmentStore.count(), 0);
  assert.equal(conversationStore.contextFor('user-a'), null);
});

test('CREATE: occupied slot does not create a second appointment and returns to time', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed('customer-user-b', '2030-01-02', '14:30');

  await advanceToSchedulingConfirmation(engine);
  const result = await engine.handle({
    conversationId: 'user-a',
    text: 's',
  });

  assert.equal(result.state, 'SCHEDULING_TIME');
  assert.match(result.reply, /já está ocupado/);
  assert.equal(appointmentStore.count(), 1);
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
  });
});

test('READ: reports when customer has no appointments', async () => {
  const { engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'meus agendamentos',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Você não possui agendamentos.');
});

test('READ: active commands are case-insensitive and ignore extra spaces', async () => {
  const { engine } = createHarness();

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '  MEUS   AGENDAMENTOS  ',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Você não possui agendamentos.');
});

test('READ: lists one appointment without exposing internal id', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '14:30',
    'internal-secret-id',
  );

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'agendamentos',
  });

  assert.match(result.reply, /1\. 02\/01\/2030 às 14:30/);
  assert.equal(result.reply.includes(appointment.id), false);
});

test('READ: lists multiple appointments ordered by date then time', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const customerId = conversationStore.customerFor('user-a');
  appointmentStore.seed(customerId, '2030-01-03', '09:00');
  appointmentStore.seed(customerId, '2030-01-02', '16:00');
  appointmentStore.seed(customerId, '2030-01-02', '10:00');

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'meus agendamentos',
  });

  const first = result.reply.indexOf('02/01/2030 às 10:00');
  const second = result.reply.indexOf('02/01/2030 às 16:00');
  const third = result.reply.indexOf('03/01/2030 às 09:00');
  assert.ok(first < second && second < third);
});

test('READ: customer sees only own appointments', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  appointmentStore.seed(
    conversationStore.customerFor('user-b'),
    '2030-01-03',
    '11:00',
  );

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'meus agendamentos',
  });

  assert.match(result.reply, /02\/01\/2030 às 10:00/);
  assert.equal(result.reply.includes('03/01/2030 às 11:00'), false);
});

test('DELETE: cancel command lists customer appointments and enters selection', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });

  assert.equal(result.state, 'CANCELING_SELECT');
  assert.match(result.reply, /Qual agendamento deseja cancelar/);
  assert.match(result.reply, /1\. 02\/01\/2030 às 10:00/);
});

test('DELETE: invalid selection remains in CANCELING_SELECT', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '99',
  });

  assert.equal(result.state, 'CANCELING_SELECT');
  assert.match(result.reply, /Opção inválida/);
});

test('DELETE: valid selection persists selectedAppointmentId', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const customerId = conversationStore.customerFor('user-a');
  appointmentStore.seed(customerId, '2030-01-02', '10:00');
  const selected = appointmentStore.seed(
    customerId,
    '2030-01-03',
    '11:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '2',
  });

  assert.equal(result.state, 'CANCELING_CONFIRMATION');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    selectedAppointmentId: selected.id,
  });
});

test('DELETE: positive confirmation deletes appointment', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sim',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(
    result.reply,
    'Agendamento cancelado com sucesso. Obrigado pela preferência!',
  );
  assert.equal(appointmentStore.count(), 0);
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    awaitingCourtesyReply: true,
  });
});

test('DELETE: negative confirmation preserves appointment', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'n',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Cancelamento não realizado.');
  assert.ok(appointmentStore.get(appointment.id));
});

test('DELETE: removed appointment is recovered as no longer available', async () => {
  const { conversationStore, appointmentStore, appointmentService, engine } =
    createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });
  await appointmentService.cancel(
    appointment.id,
    conversationStore.customerFor('user-a'),
  );

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sim',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Esse agendamento não está mais disponível.');
});

test('DELETE: cancellation releases slot for another customer', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });
  await engine.handle({ conversationId: 'user-a', text: 'sim' });

  await schedule(engine, 'user-b', '02/01/2030', '10:00');

  assert.equal(appointmentStore.count(), 1);
  const userBAppointments = await appointmentStore.listByCustomer(
    conversationStore.customerFor('user-b'),
  );
  assert.equal(userBAppointments.length, 1);
});

test('DELETE: service prevents customer from deleting another customer appointment', async () => {
  const { conversationStore, appointmentStore, appointmentService } =
    createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-b'),
    '2030-01-02',
    '10:00',
  );

  const result = await appointmentService.cancel(
    appointment.id,
    conversationStore.customerFor('user-a'),
  );

  assert.deepEqual(result, { status: 'NOT_FOUND' });
  assert.ok(appointmentStore.get(appointment.id));
});

test('UPDATE: reschedule command lists options and enters selection', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'remarcar agendamento',
  });

  assert.equal(result.state, 'RESCHEDULING_SELECT');
  assert.match(result.reply, /Qual agendamento deseja remarcar/);
});

test('UPDATE: valid selection stores appointment id and asks for new date', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'remarcar agendamento',
  });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '1',
  });

  assert.equal(result.state, 'RESCHEDULING_DATE');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    selectedAppointmentId: appointment.id,
  });
});

test('UPDATE: new valid date and time advance with persisted context', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'remarcar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });

  const dateResult = await engine.handle({
    conversationId: 'user-a',
    text: '05/01/2030',
  });
  const timeResult = await engine.handle({
    conversationId: 'user-a',
    text: '15:00',
  });

  assert.equal(dateResult.state, 'RESCHEDULING_TIME');
  assert.equal(timeResult.state, 'RESCHEDULING_CONFIRMATION');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    selectedAppointmentId: appointment.id,
    draftDate: '2030-01-05',
    draftTime: '15:00',
  });
});

test('UPDATE: successful reschedule preserves appointment identity and createdAt', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const original = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'remarcar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });
  await engine.handle({ conversationId: 'user-a', text: '05/01/2030' });
  await engine.handle({ conversationId: 'user-a', text: '15:00' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sim',
  });
  const updated = appointmentStore.get(original.id);

  assert.equal(result.state, 'ACTIVE');
  assert.equal(
    result.reply,
    'Agendamento remarcado para 05/01/2030 às 15:00. Obrigado pela preferência!',
  );
  assert.equal(updated?.id, original.id);
  assert.equal(updated?.customerId, original.customerId);
  assert.equal(updated?.createdAt.getTime(), original.createdAt.getTime());
  assert.equal(updated?.date, '2030-01-05');
  assert.equal(updated?.time, '15:00');
});

test('UPDATE: occupied target slot does not change original appointment', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const original = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  appointmentStore.seed(
    conversationStore.customerFor('user-b'),
    '2030-01-05',
    '15:00',
  );

  await engine.handle({
    conversationId: 'user-a',
    text: 'remarcar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });
  await engine.handle({ conversationId: 'user-a', text: '05/01/2030' });
  await engine.handle({ conversationId: 'user-a', text: '15:00' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sim',
  });
  const unchanged = appointmentStore.get(original.id);

  assert.equal(result.state, 'RESCHEDULING_TIME');
  assert.match(result.reply, /já está ocupado/);
  assert.equal(unchanged?.date, '2030-01-02');
  assert.equal(unchanged?.time, '10:00');
  assert.deepEqual(conversationStore.contextFor('user-a'), {
    selectedAppointmentId: original.id,
    draftDate: '2030-01-05',
  });
});

test('UPDATE: negative confirmation leaves appointment unchanged', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  const original = appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  await engine.handle({
    conversationId: 'user-a',
    text: 'remarcar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });
  await engine.handle({ conversationId: 'user-a', text: '05/01/2030' });
  await engine.handle({ conversationId: 'user-a', text: '15:00' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'nao',
  });
  const unchanged = appointmentStore.get(original.id);

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Remarcação não realizada.');
  assert.equal(unchanged?.date, original.date);
  assert.equal(unchanged?.time, original.time);
});

test('UPDATE: service prevents customer from rescheduling another customer appointment', async () => {
  const { conversationStore, appointmentStore, appointmentService } =
    createHarness();
  const appointment = appointmentStore.seed(
    conversationStore.customerFor('user-b'),
    '2030-01-02',
    '10:00',
  );

  const result = await appointmentService.reschedule(
    appointment.id,
    conversationStore.customerFor('user-a'),
    '2030-01-05',
    '15:00',
  );

  assert.deepEqual(result, { status: 'NOT_FOUND' });
  const unchanged = appointmentStore.get(appointment.id);
  assert.equal(unchanged?.date, '2030-01-02');
  assert.equal(unchanged?.time, '10:00');
});

test('STATE/CONTEXT: draftDate does not leak between customers', async () => {
  const { conversationStore, engine } = createHarness();

  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });
  await engine.handle({ conversationId: 'user-b', text: 'agendar' });

  assert.deepEqual(conversationStore.contextFor('user-a'), {
    draftDate: '2030-01-02',
  });
  assert.equal(conversationStore.contextFor('user-b'), null);
  assert.equal(conversationStore.stateFor('user-b'), 'SCHEDULING_DATE');
});

test('STATE/CONTEXT: selectedAppointmentId does not leak between customers', async () => {
  const { conversationStore, appointmentStore, engine } = createHarness();
  appointmentStore.seed(
    conversationStore.customerFor('user-a'),
    '2030-01-02',
    '10:00',
  );
  appointmentStore.seed(
    conversationStore.customerFor('user-b'),
    '2030-01-03',
    '11:00',
  );

  await engine.handle({
    conversationId: 'user-a',
    text: 'cancelar agendamento',
  });
  await engine.handle({ conversationId: 'user-a', text: '1' });
  await engine.handle({
    conversationId: 'user-b',
    text: 'cancelar agendamento',
  });

  assert.ok(
    conversationStore.contextFor('user-a')?.selectedAppointmentId,
  );
  assert.equal(conversationStore.contextFor('user-b'), null);
});

test('STATE/CONTEXT: sair abandons flow and clears context', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sair',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(conversationStore.contextFor('user-a'), null);
});

test('STATE/CONTEXT: voltar abandons flow and clears context', async () => {
  const { conversationStore, engine } = createHarness();
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'voltar',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(conversationStore.contextFor('user-a'), null);
});

test('STATE/CONTEXT: persisted draft survives engine recreation', async () => {
  const {
    conversationStore,
    appointmentService,
    engine: firstEngine,
  } = createHarness();
  await firstEngine.handle({ conversationId: 'user-a', text: 'agendar' });
  await firstEngine.handle({
    conversationId: 'user-a',
    text: '02/01/2030',
  });

  const restartedEngine = new ConversationEngine(
    conversationStore,
    appointmentService,
  );
  const result = await restartedEngine.handle({
    conversationId: 'user-a',
    text: '14:00',
  });

  assert.equal(result.state, 'SCHEDULING_NAME');
  assert.equal(result.reply, 'Qual é o seu nome?');
});

test('STATE/CONTEXT: inconsistent context recovers safely to ACTIVE', async () => {
  const { conversationStore, engine } = createHarness();
  conversationStore.seedSession('user-a', 'SCHEDULING_TIME', null);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: '14:00',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.match(result.reply, /Não foi possível continuar/);
  assert.equal(conversationStore.contextFor('user-a'), null);
});

test('COURTESY: replies politely after a completed operation', async () => {
  const { engine } = createHarness();
  await schedule(engine);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'Não há de quê',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, 'Um prazer ter você aqui. 😊');
});

test('COURTESY: does not hijack unrelated active conversation', async () => {
  const { engine } = createHarness();
  await activate(engine);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'de nada',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, DEFAULT_REPLY);
});

test('ACTIVE: unknown message displays the clinic menu', async () => {
  const { engine } = createHarness();
  await activate(engine);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'marca pra terça depois do almoço',
  });

  assert.equal(result.reply, DEFAULT_REPLY);
  assert.equal(result.state, 'ACTIVE');
});

test('ERRORS: unexpected appointment persistence error propagates to integration boundary', async () => {
  const { appointmentStore, engine } = createHarness();
  await advanceToSchedulingConfirmation(engine);
  appointmentStore.create = async () => {
    throw new Error('appointment database failure');
  };

  await assert.rejects(
    engine.handle({ conversationId: 'user-a', text: 'sim' }),
    /appointment database failure/,
  );
});


test('INACTIVITY: resets state and clears context after timeout', async () => {
  const { conversationStore, engine } = createHarness();

  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.handle({ conversationId: 'user-a', text: '02/01/2030' });

  const result = await engine.expireInactiveConversation('user-a');

  assert.equal(result.state, 'INITIAL');
  assert.equal(result.reply, INACTIVITY_REPLY);
  assert.equal(conversationStore.stateFor('user-a'), 'INITIAL');
  assert.equal(conversationStore.contextFor('user-a'), null);
});

test('INACTIVITY: next inbound starts from a clean conversation', async () => {
  const { engine } = createHarness();

  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  await engine.expireInactiveConversation('user-a');

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'Olá novamente',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.reply, DEFAULT_REPLY);
});


test('ACTIVE: explicit sair marks the chat as ended', async () => {
  const { engine } = createHarness();
  await activate(engine);

  const result = await engine.handle({
    conversationId: 'user-a',
    text: 'sair',
  });

  assert.equal(result.state, 'ACTIVE');
  assert.equal(result.ended, true);
  assert.equal(result.reply, 'Atendimento encerrado. Até logo! 👋');
});

test('AUTOMATION: custom inbound reply is used after no native intent matches', async () => {
  const conversationStore = new InMemoryConversationStore();
  const appointmentStore = new InMemoryAppointmentStore();
  const engine = new ConversationEngine(
    conversationStore,
    new AppointmentService(appointmentStore, NOW),
    undefined,
    { findReply: async (text) => text.includes('serviços') ? 'Trabalhamos com automação.' : null },
  );
  const result = await engine.handle({ conversationId: 'user-a', text: 'Quais serviços vocês oferecem?' });
  assert.equal(result.reply, 'Trabalhamos com automação.');
  assert.equal(result.state, 'ACTIVE');
});

test('AUTOMATION: native reschedule synonyms have priority over custom rules', async () => {
  const conversationStore = new InMemoryConversationStore();
  const appointmentStore = new InMemoryAppointmentStore();
  const engine = new ConversationEngine(
    conversationStore,
    new AppointmentService(appointmentStore, NOW),
    undefined,
    { findReply: async () => 'CUSTOM' },
  );
  const result = await engine.handle({ conversationId: 'user-a', text: 'reagendar' });
  assert.equal(result.reply, 'Você não possui agendamentos para remarcar.');
});

test('AUTOMATION: active conversation flow consumes selections before custom rules', async () => {
  let matcherCalls = 0;
  const conversationStore = new InMemoryConversationStore();
  const engine = new ConversationEngine(
    conversationStore,
    new AppointmentService(new InMemoryAppointmentStore(), NOW),
    undefined,
    { findReply: async () => { matcherCalls += 1; return 'CUSTOM'; } },
  );
  await engine.handle({ conversationId: 'user-a', text: 'agendar' });
  const result = await engine.handle({ conversationId: 'user-a', text: '1' });
  assert.equal(result.state, 'SCHEDULING_DATE');
  assert.equal(matcherCalls, 0);
});
