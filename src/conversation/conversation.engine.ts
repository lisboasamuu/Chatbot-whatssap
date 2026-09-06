import type { AppointmentService } from '../appointments/appointment.service.js';
import {
  formatDateForDisplay,
  isNormalizedDate,
  isNormalizedTime,
  parseDateInput,
  parseTimeInput,
  type Appointment,
} from '../appointments/appointment.types.js';
import type { ConversationStore } from './conversation.store.js';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
  type MessageTemplateType,
} from '../message-templates/message-template.js';
import type {
  ConversationContext,
  ConversationInput,
  ConversationResult,
  ConversationSession,
  ConversationState,
} from './conversation.types.js';

export const FALLBACK_REPLY = 'Desculpe, não entendi.';

//Atualizando a default reply para suportar mensagem mais profissional ao atendimento
export const DEFAULT_REPLY = DEFAULT_MESSAGE_TEMPLATES.WELCOME;

const FLOW_ABORTED_REPLY = 'Operação encerrada.';
const FLOW_RECOVERY_REPLY =
  'Não foi possível continuar a operação. Inicie novamente.';
const INVALID_DATE_REPLY = 'Data inválida. Envie no formato DD/MM/AAAA.';
const PAST_DATE_REPLY =
  'A data deve ser hoje ou futura. Envie no formato DD/MM/AAAA.';
const INVALID_TIME_REPLY = 'Horário inválido. Envie no formato HH:mm.';
const PAST_SLOT_REPLY =
  'Data e horário devem estar no futuro. Envie outro horário no formato HH:mm.';
const YES_NO_REPLY = 'Responda "sim" ou "não".';
const SLOT_UNAVAILABLE_REPLY =
  'Esse horário já está ocupado. Envie outro horário no formato HH:mm.';
const INVALID_NAME_REPLY =
  'Nome inválido. Informe seu nome usando apenas letras, espaços, hífen ou apóstrofo.';
const COURTESY_REPLY = 'Um prazer ter você aqui. 😊';
export const INACTIVITY_REPLY =
  'Atendimento encerrado automaticamente por inatividade. Quando precisar, é só enviar uma nova mensagem. Até logo! 👋';

export interface ConversationMessageTemplateProvider {
  getMessageTemplate(type: Exclude<MessageTemplateType, 'REMINDER'>): Promise<string | null>;
  isActive?(): Promise<boolean>;
}

const ACTIVE_COMMANDS = new Set([
  'agendar',
  'meus agendamentos',
  'agendamentos',
  'cancelar agendamento',
  'remarcar agendamento',
  'gostaria de marcar',
  'quero marcar',
  'marcar consulta'
]);

const FLOW_STATES = new Set<ConversationState>([
  'SCHEDULING_DATE',
  'SCHEDULING_TIME',
  'SCHEDULING_NAME',
  'SCHEDULING_CONFIRMATION',
  'CANCELING_SELECT',
  'CANCELING_CONFIRMATION',
  'RESCHEDULING_SELECT',
  'RESCHEDULING_DATE',
  'RESCHEDULING_TIME',
  'RESCHEDULING_CONFIRMATION',
]);

function normalizeCommand(text: string): string {
  return text.toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
}

function isAffirmative(command: string): boolean {
  return command === 'sim' || command === 's';
}

function isNegative(command: string): boolean {
  return command === 'não' || command === 'nao' || command === 'n';
}

function isExitCommand(command: string): boolean {
  return command === 'sair' || command === 'voltar';
}

function isCourtesyReply(command: string): boolean {
  const normalized = command
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return new Set([
    'de nada',
    'por nada',
    'imagina',
    'nao ha de que',
    'disponha',
  ]).has(normalized);
}

function normalizeName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');

  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[\p{L}\p{M}][\p{L}\p{M}' -]{1,99}$/u.test(name)
  ) {
    return null;
  }

  return name;
}

function parseSelection(input: string, length: number): number | null {
  if (!/^\d+$/.test(input)) {
    return null;
  }

  const selected = Number(input);
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > length) {
    return null;
  }

  return selected - 1;
}

function formatAppointment(appointment: Appointment): string {
  return `${formatDateForDisplay(appointment.date)} às ${appointment.time}`;
}

function formatAppointmentList(appointments: Appointment[]): string {
  return appointments
    .map((appointment, index) => `${index + 1}. ${formatAppointment(appointment)}`)
    .join('\n');
}

function hasDraftDate(
  context: ConversationContext | null,
): context is ConversationContext & { draftDate: string } {
  return Boolean(context?.draftDate && isNormalizedDate(context.draftDate));
}

function hasDraftDateAndTime(
  context: ConversationContext | null,
): context is ConversationContext & { draftDate: string; draftTime: string } {
  return Boolean(
    context?.draftDate &&
      context.draftTime &&
      isNormalizedDate(context.draftDate) &&
      isNormalizedTime(context.draftTime),
  );
}

function hasSchedulingConfirmationContext(
  context: ConversationContext | null,
): context is ConversationContext & {
  draftDate: string;
  draftTime: string;
  draftName: string;
} {
  return Boolean(
    hasDraftDateAndTime(context) &&
      context.draftName &&
      normalizeName(context.draftName),
  );
}

function hasSelectedAppointment(
  context: ConversationContext | null,
): context is ConversationContext & { selectedAppointmentId: string } {
  return Boolean(context?.selectedAppointmentId?.trim());
}

function hasSelectedAppointmentAndDate(
  context: ConversationContext | null,
): context is ConversationContext & {
  selectedAppointmentId: string;
  draftDate: string;
} {
  return Boolean(
    context?.selectedAppointmentId?.trim() &&
      context.draftDate &&
      isNormalizedDate(context.draftDate),
  );
}

function hasRescheduleConfirmationContext(
  context: ConversationContext | null,
): context is ConversationContext & {
  selectedAppointmentId: string;
  draftDate: string;
  draftTime: string;
} {
  return Boolean(
    context?.selectedAppointmentId?.trim() &&
      context.draftDate &&
      context.draftTime &&
      isNormalizedDate(context.draftDate) &&
      isNormalizedTime(context.draftTime),
  );
}

export class ConversationEngine {
  public constructor(
    private readonly store: ConversationStore,
    private readonly appointmentService: AppointmentService,
    private readonly messageTemplates?: ConversationMessageTemplateProvider,
  ) {}

  private async template(
    type: Exclude<MessageTemplateType, 'REMINDER'>,
    variables: Record<string, string> = {},
  ): Promise<string> {
    const custom = await this.messageTemplates?.getMessageTemplate(type);
    return renderMessageTemplate(
      type,
      custom ?? DEFAULT_MESSAGE_TEMPLATES[type],
      variables,
    );
  }

  public async handle(input: ConversationInput): Promise<ConversationResult> {
    const externalUserId = input.conversationId.trim();

    if (!externalUserId) {
      return {
        conversationId: '',
        reply: FALLBACK_REPLY,
        state: 'INITIAL',
      };
    }

    if (this.messageTemplates?.isActive && !(await this.messageTemplates.isActive())) {
      return {
        conversationId: externalUserId,
        reply: await this.template('BUSINESS_CLOSED'),
        state: 'INITIAL',
        ended: true,
      };
    }

    const session = await this.store.getOrCreateSession(externalUserId);
    const messageType = input.type ?? 'text';
    const text = input.text?.trim() ?? '';

    await this.store.saveMessage({
      conversationId: session.id,
      direction: 'INBOUND',
      body: input.text ?? '',
    });

    if (messageType !== 'text' || !text) {
      return this.result(session, FALLBACK_REPLY, session.state);
    }

    const command = normalizeCommand(text);

    if (session.state === 'ACTIVE' && session.context?.awaitingCourtesyReply) {
      if (isCourtesyReply(command)) {
        return this.transition(session, 'ACTIVE', null, COURTESY_REPLY);
      }

      await this.store.updateSession(session.id, {
        state: 'ACTIVE',
        context: null,
      });
      session.context = null;
    }

    if (FLOW_STATES.has(session.state) && isExitCommand(command)) {
      return this.transition(session, 'ACTIVE', null, FLOW_ABORTED_REPLY);
    }

    if (session.state === 'INITIAL') {
      if (ACTIVE_COMMANDS.has(command)) {
        return this.handleActive(session, command);
      }

      return this.transition(session, 'ACTIVE', null, await this.template('WELCOME'));
    }

    switch (session.state) {
      case 'ACTIVE':
        return this.handleActive(session, command);
      case 'SCHEDULING_DATE':
        return this.handleSchedulingDate(session, text);
      case 'SCHEDULING_TIME':
        return this.handleSchedulingTime(session, text);
      case 'SCHEDULING_NAME':
        return this.handleSchedulingName(session, text);
      case 'SCHEDULING_CONFIRMATION':
        return this.handleSchedulingConfirmation(session, command);
      case 'CANCELING_SELECT':
        return this.handleCancelingSelect(session, text);
      case 'CANCELING_CONFIRMATION':
        return this.handleCancelingConfirmation(session, command);
      case 'RESCHEDULING_SELECT':
        return this.handleReschedulingSelect(session, text);
      case 'RESCHEDULING_DATE':
        return this.handleReschedulingDate(session, text);
      case 'RESCHEDULING_TIME':
        return this.handleReschedulingTime(session, text);
      case 'RESCHEDULING_CONFIRMATION':
        return this.handleReschedulingConfirmation(session, command);
    }
  }


  public async expireInactiveConversation(
    externalUserId: string,
  ): Promise<ConversationResult> {
    const id = externalUserId.trim();
    if (!id) {
      return {
        conversationId: '',
        reply: INACTIVITY_REPLY,
        state: 'INITIAL',
      };
    }

    if (this.messageTemplates?.isActive && !(await this.messageTemplates.isActive())) {
      return {
        conversationId: id,
        reply: await this.template('BUSINESS_CLOSED'),
        state: 'INITIAL',
        ended: true,
      };
    }

    const session = await this.store.getOrCreateSession(id);
    await this.store.updateSession(session.id, {
      state: 'INITIAL',
      context: null,
    });
    return this.result(session, INACTIVITY_REPLY, 'INITIAL', true);
  }

  public async recordOutbound(
    conversationId: string,
    body: string,
  ): Promise<void> {
    await this.store.saveMessage({
      conversationId,
      direction: 'OUTBOUND',
      body,
    });
  }

  private async handleActive(
    session: ConversationSession,
    command: string,
  ): Promise<ConversationResult> {
    switch (command) {
      case 'agendar':
        return this.transition(
          session,
          'SCHEDULING_DATE',
          null,
          'Qual data você deseja? Envie no formato DD/MM/AAAA.',
        );


      case 'meus agendamentos':
      case 'agendamentos': {
        const appointments = await this.appointmentService.list(
          session.customerId,
        );
        const reply =
          appointments.length === 0
            ? await this.template('NO_APPOINTMENTS')
            : `Seus agendamentos:\n\n${formatAppointmentList(appointments)}`;

        if (session.state === 'INITIAL') {
          return this.transition(session, 'ACTIVE', null, reply);
        }

        return this.result(session, reply, 'ACTIVE');
      }

      case 'cancelar agendamento': {
        const appointments = await this.appointmentService.list(
          session.customerId,
        );

        if (appointments.length === 0) {
          return this.transition(
            session,
            'ACTIVE',
            null,
            'Você não possui agendamentos para cancelar.',
          );
        }

        return this.transition(
          session,
          'CANCELING_SELECT',
          null,
          `Qual agendamento deseja cancelar?\n\n${formatAppointmentList(
            appointments,
          )}\n\nResponda com o número.`,
        );
      }

      case 'remarcar agendamento': {
        const appointments = await this.appointmentService.list(
          session.customerId,
        );

        if (appointments.length === 0) {
          return this.transition(
            session,
            'ACTIVE',
            null,
            'Você não possui agendamentos para remarcar.',
          );
        }

        return this.transition(
          session,
          'RESCHEDULING_SELECT',
          null,
          `Qual agendamento deseja remarcar?\n\n${formatAppointmentList(
            appointments,
          )}\n\nResponda com o número.`,
        );
      }

      case 'sair':
        return this.result(
          session,
          'Atendimento encerrado. Até logo! 👋',
          'ACTIVE',
          true,
        );

      default:
        return this.result(session, await this.template('WELCOME'), 'ACTIVE');
    }
  }

  private async handleSchedulingDate(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    const date = parseDateInput(
      text,
      this.appointmentService.currentLocalDate(),
    );

    if (!date) {
      return this.result(session, INVALID_DATE_REPLY, 'SCHEDULING_DATE');
    }

    if (!this.appointmentService.isDateTodayOrFuture(date)) {
      return this.result(session, PAST_DATE_REPLY, 'SCHEDULING_DATE');
    }

    return this.transition(
      session,
      'SCHEDULING_TIME',
      { draftDate: date },
      'Qual horário você deseja? Envie no formato HH:mm.',
    );
  }

  private async handleSchedulingTime(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    if (!hasDraftDate(session.context)) {
      return this.recoverFlow(session);
    }

    const time = parseTimeInput(text);
    if (!time) {
      return this.result(session, INVALID_TIME_REPLY, 'SCHEDULING_TIME');
    }

    if (!this.appointmentService.isFutureSlot(session.context.draftDate, time)) {
      return this.result(session, PAST_SLOT_REPLY, 'SCHEDULING_TIME');
    }

    const context = {
      draftDate: session.context.draftDate,
      draftTime: time,
    };

    return this.transition(
      session,
      'SCHEDULING_NAME',
      context,
      'Qual é o seu nome?',
    );
  }

  private async handleSchedulingName(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    if (!hasDraftDateAndTime(session.context)) {
      return this.recoverFlow(session);
    }

    const name = normalizeName(text);
    if (!name) {
      return this.result(session, INVALID_NAME_REPLY, 'SCHEDULING_NAME');
    }

    const context = {
      draftDate: session.context.draftDate,
      draftTime: session.context.draftTime,
      draftName: name,
    };

    return this.transition(
      session,
      'SCHEDULING_CONFIRMATION',
      context,
      `Confirma o agendamento de ${context.draftName} para ${formatDateForDisplay(
        context.draftDate,
      )} às ${context.draftTime}? Responda "sim" ou "não".`,
    );
  }

  private async handleSchedulingConfirmation(
    session: ConversationSession,
    command: string,
  ): Promise<ConversationResult> {
    if (!hasSchedulingConfirmationContext(session.context)) {
      return this.recoverFlow(session);
    }

    if (isNegative(command)) {
      return this.transition(
        session,
        'ACTIVE',
        null,
        'Agendamento não realizado.',
      );
    }

    if (!isAffirmative(command)) {
      return this.result(
        session,
        YES_NO_REPLY,
        'SCHEDULING_CONFIRMATION',
      );
    }

    const result = await this.appointmentService.create(
      session.customerId,
      session.context.draftName,
      session.context.draftDate,
      session.context.draftTime,
    );

    if (result.status === 'SLOT_UNAVAILABLE') {
      return this.transition(
        session,
        'SCHEDULING_TIME',
        { draftDate: session.context.draftDate },
        SLOT_UNAVAILABLE_REPLY,
      );
    }

    if (result.status === 'INVALID_SLOT') {
      return this.transition(
        session,
        'SCHEDULING_TIME',
        { draftDate: session.context.draftDate },
        PAST_SLOT_REPLY,
      );
    }

    if (result.status === 'OUTSIDE_BUSINESS_HOURS') {
      return this.transition(
        session,
        'SCHEDULING_TIME',
        { draftDate: session.context.draftDate },
        await this.template('BUSINESS_CLOSED'),
      );
    }

    return this.transition(
      session,
      'ACTIVE',
      { awaitingCourtesyReply: true },
      await this.template('APPOINTMENT_CREATED', {
        date: formatDateForDisplay(result.appointment.date),
        time: result.appointment.time,
      }),
    );
  }

  private async handleCancelingSelect(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    const appointments = await this.appointmentService.list(session.customerId);

    if (appointments.length === 0) {
      return this.transition(
        session,
        'ACTIVE',
        null,
        'Você não possui agendamentos para cancelar.',
      );
    }

    const selection = parseSelection(text, appointments.length);
    if (selection === null) {
      return this.result(
        session,
        'Opção inválida. Responda com o número de um dos agendamentos listados.',
        'CANCELING_SELECT',
      );
    }

    const appointment = appointments[selection];
    if (!appointment) {
      return this.result(
        session,
        'Opção inválida. Responda com o número de um dos agendamentos listados.',
        'CANCELING_SELECT',
      );
    }

    return this.transition(
      session,
      'CANCELING_CONFIRMATION',
      { selectedAppointmentId: appointment.id },
      `Confirma o cancelamento de ${formatAppointment(
        appointment,
      )}? Responda "sim" ou "não".`,
    );
  }

  private async handleCancelingConfirmation(
    session: ConversationSession,
    command: string,
  ): Promise<ConversationResult> {
    if (!hasSelectedAppointment(session.context)) {
      return this.recoverFlow(session);
    }

    if (isNegative(command)) {
      return this.transition(
        session,
        'ACTIVE',
        null,
        'Cancelamento não realizado.',
      );
    }

    if (!isAffirmative(command)) {
      return this.result(
        session,
        YES_NO_REPLY,
        'CANCELING_CONFIRMATION',
      );
    }

    const result = await this.appointmentService.cancel(
      session.context.selectedAppointmentId,
      session.customerId,
    );

    if (result.status === 'CANCELLED') {
      return this.transition(
        session,
        'ACTIVE',
        { awaitingCourtesyReply: true },
        await this.template('APPOINTMENT_CANCELLED'),
      );
    }

    return this.transition(
      session,
      'ACTIVE',
      null,
      'Esse agendamento não está mais disponível.',
    );
  }

  private async handleReschedulingSelect(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    const appointments = await this.appointmentService.list(session.customerId);

    if (appointments.length === 0) {
      return this.transition(
        session,
        'ACTIVE',
        null,
        'Você não possui agendamentos para remarcar.',
      );
    }

    const selection = parseSelection(text, appointments.length);
    if (selection === null) {
      return this.result(
        session,
        'Opção inválida. Responda com o número de um dos agendamentos listados.',
        'RESCHEDULING_SELECT',
      );
    }

    const appointment = appointments[selection];
    if (!appointment) {
      return this.result(
        session,
        'Opção inválida. Responda com o número de um dos agendamentos listados.',
        'RESCHEDULING_SELECT',
      );
    }

    return this.transition(
      session,
      'RESCHEDULING_DATE',
      { selectedAppointmentId: appointment.id },
      'Qual será a nova data? Envie no formato DD/MM/AAAA.',
    );
  }

  private async handleReschedulingDate(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    if (!hasSelectedAppointment(session.context)) {
      return this.recoverFlow(session);
    }

    const date = parseDateInput(
      text,
      this.appointmentService.currentLocalDate(),
    );
    if (!date) {
      return this.result(session, INVALID_DATE_REPLY, 'RESCHEDULING_DATE');
    }

    if (!this.appointmentService.isDateTodayOrFuture(date)) {
      return this.result(session, PAST_DATE_REPLY, 'RESCHEDULING_DATE');
    }

    return this.transition(
      session,
      'RESCHEDULING_TIME',
      {
        selectedAppointmentId: session.context.selectedAppointmentId,
        draftDate: date,
      },
      'Qual será o novo horário? Envie no formato HH:mm.',
    );
  }

  private async handleReschedulingTime(
    session: ConversationSession,
    text: string,
  ): Promise<ConversationResult> {
    if (!hasSelectedAppointmentAndDate(session.context)) {
      return this.recoverFlow(session);
    }

    const time = parseTimeInput(text);
    if (!time) {
      return this.result(session, INVALID_TIME_REPLY, 'RESCHEDULING_TIME');
    }

    if (!this.appointmentService.isFutureSlot(session.context.draftDate, time)) {
      return this.result(session, PAST_SLOT_REPLY, 'RESCHEDULING_TIME');
    }

    const context = {
      selectedAppointmentId: session.context.selectedAppointmentId,
      draftDate: session.context.draftDate,
      draftTime: time,
    };

    return this.transition(
      session,
      'RESCHEDULING_CONFIRMATION',
      context,
      `Confirma a remarcação para ${formatDateForDisplay(
        context.draftDate,
      )} às ${context.draftTime}? Responda "sim" ou "não".`,
    );
  }

  private async handleReschedulingConfirmation(
    session: ConversationSession,
    command: string,
  ): Promise<ConversationResult> {
    if (!hasRescheduleConfirmationContext(session.context)) {
      return this.recoverFlow(session);
    }

    if (isNegative(command)) {
      return this.transition(
        session,
        'ACTIVE',
        null,
        'Remarcação não realizada.',
      );
    }

    if (!isAffirmative(command)) {
      return this.result(
        session,
        YES_NO_REPLY,
        'RESCHEDULING_CONFIRMATION',
      );
    }

    const result = await this.appointmentService.reschedule(
      session.context.selectedAppointmentId,
      session.customerId,
      session.context.draftDate,
      session.context.draftTime,
    );

    if (result.status === 'SLOT_UNAVAILABLE') {
      return this.transition(
        session,
        'RESCHEDULING_TIME',
        {
          selectedAppointmentId: session.context.selectedAppointmentId,
          draftDate: session.context.draftDate,
        },
        SLOT_UNAVAILABLE_REPLY,
      );
    }

    if (result.status === 'INVALID_SLOT') {
      return this.transition(
        session,
        'RESCHEDULING_TIME',
        {
          selectedAppointmentId: session.context.selectedAppointmentId,
          draftDate: session.context.draftDate,
        },
        PAST_SLOT_REPLY,
      );
    }

    if (result.status === 'OUTSIDE_BUSINESS_HOURS') {
      return this.transition(
        session,
        'RESCHEDULING_TIME',
        {
          selectedAppointmentId: session.context.selectedAppointmentId,
          draftDate: session.context.draftDate,
        },
        await this.template('BUSINESS_CLOSED'),
      );
    }

    if (result.status === 'NOT_FOUND') {
      return this.transition(
        session,
        'ACTIVE',
        null,
        'Esse agendamento não está mais disponível.',
      );
    }

    return this.transition(
      session,
      'ACTIVE',
      { awaitingCourtesyReply: true },
      await this.template('APPOINTMENT_RESCHEDULED', {
        date: formatDateForDisplay(result.appointment.date),
        time: result.appointment.time,
      }),
    );
  }

  private async recoverFlow(
    session: ConversationSession,
  ): Promise<ConversationResult> {
    return this.transition(session, 'ACTIVE', null, FLOW_RECOVERY_REPLY);
  }

  private async transition(
    session: ConversationSession,
    state: ConversationState,
    context: ConversationContext | null,
    reply: string,
  ): Promise<ConversationResult> {
    await this.store.updateSession(session.id, { state, context });
    return this.result(session, reply, state);
  }

  private result(
    session: ConversationSession,
    reply: string,
    state: ConversationState,
    ended = false,
  ): ConversationResult {
    return {
      conversationId: session.id,
      reply,
      state,
      ...(ended ? { ended: true } : {}),
    };
  }
}
