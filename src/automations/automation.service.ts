import type { Prisma, PrismaClient, Weekday } from '@prisma/client';
import { nextScheduledRun, validDate, validTime } from './automation.schedule.js';
import { normalizeInboundText, phraseMatches } from './automation.matching.js';
import {
  AutomationNotFoundError,
  AutomationValidationError,
  MAX_AUTOMATION_MESSAGE_LENGTH,
  MAX_AUTOMATION_NAME_LENGTH,
  MAX_AUTOMATION_RECIPIENTS,
  MAX_INBOUND_VARIATIONS,
  MAX_WEEKLY_TIMES,
  type AutomationInput,
  type AutomationWeekday,
  type InboundAutomationMatcher,
} from './automation.types.js';

const WEEKDAYS = new Set<AutomationWeekday>([
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
]);

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new AutomationValidationError('INVALID_INPUT', `${label} é obrigatório.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > max) {
    throw new AutomationValidationError('INVALID_INPUT', `${label} deve ter entre 1 e ${max} caracteres.`);
  }
  return normalized;
}

function bodyText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new AutomationValidationError('INVALID_INPUT', `${label} é obrigatória.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_AUTOMATION_MESSAGE_LENGTH) {
    throw new AutomationValidationError('INVALID_INPUT', `${label} deve ter entre 1 e ${MAX_AUTOMATION_MESSAGE_LENGTH} caracteres.`);
  }
  return normalized;
}

function uniqueStrings(values: unknown, label: string): string[] {
  if (!Array.isArray(values) || values.some((item) => typeof item !== 'string')) {
    throw new AutomationValidationError('INVALID_INPUT', `${label} inválidos.`);
  }
  return [...new Set((values as string[]).map((item) => item.trim()).filter(Boolean))];
}

export function normalizeWhatsAppNumber(value: string): string {
  const trimmed = value.trim();
  const serialized = /^(\d{10,15})@(c\.us|lid)$/.exec(trimmed);
  if (serialized) return trimmed;
  let digits = trimmed.replace(/\D/g, '');
  if ((digits.length === 10 || digits.length === 11) && !trimmed.trim().startsWith('+')) digits = `55${digits}`;
  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) {
    throw new AutomationValidationError('INVALID_PHONE', 'Informe um número de WhatsApp válido, com DDD e código do país quando necessário.');
  }
  return `${digits}@c.us`;
}

export function validateAutomationInput(input: AutomationInput, timezone: string, now: Date) {
  const name = requiredText(input.name, 'Nome', MAX_AUTOMATION_NAME_LENGTH);
  if (input.type !== 'INBOUND' && input.type !== 'SCHEDULED') {
    throw new AutomationValidationError('INVALID_TYPE', 'Tipo de automação inválido.');
  }
  if (typeof input.isActive !== 'boolean') {
    throw new AutomationValidationError('INVALID_INPUT', 'Informe se a automação está ativa.');
  }

  if (input.type === 'INBOUND') {
    const values = uniqueStrings(input.variations, 'Variações');
    if (values.length < 1 || values.length > MAX_INBOUND_VARIATIONS) {
      throw new AutomationValidationError('INVALID_VARIATIONS', `Informe de 1 a ${MAX_INBOUND_VARIATIONS} variações.`);
    }
    const variations = values.map((value) => {
      if (value.length > 200) throw new AutomationValidationError('INVALID_VARIATIONS', 'Cada variação pode ter até 200 caracteres.');
      return { value, normalizedValue: normalizeInboundText(value) };
    });
    if (variations.some((item) => !item.normalizedValue)) {
      throw new AutomationValidationError('INVALID_VARIATIONS', 'Cada variação precisa conter letras ou números.');
    }
    if (new Set(variations.map((item) => item.normalizedValue)).size !== variations.length) {
      throw new AutomationValidationError('DUPLICATE_VARIATION', 'Existem variações equivalentes após a normalização.');
    }
    return { name, type: input.type, isActive: input.isActive, responseBody: bodyText(input.responseBody, 'Resposta'), variations };
  }

  if (input.scheduleType !== 'ONE_TIME' && input.scheduleType !== 'WEEKLY') {
    throw new AutomationValidationError('INVALID_SCHEDULE', 'Frequência inválida.');
  }
  const recipientIds = uniqueStrings(input.recipientIds, 'Destinatários');
  if (!recipientIds.length || recipientIds.length > MAX_AUTOMATION_RECIPIENTS) {
    throw new AutomationValidationError('INVALID_RECIPIENTS', `Selecione de 1 a ${MAX_AUTOMATION_RECIPIENTS} contatos.`);
  }
  const messageBody = bodyText(input.messageBody, 'Mensagem');
  if (input.scheduleType === 'ONE_TIME') {
    if (!input.oneTimeDate || !validDate(input.oneTimeDate) || !input.oneTimeTime || !validTime(input.oneTimeTime)) {
      throw new AutomationValidationError('INVALID_SCHEDULE', 'Informe uma data e um horário válidos.');
    }
    const nextRunAt = nextScheduledRun({
      scheduleType: 'ONE_TIME', oneTimeDate: input.oneTimeDate, oneTimeTime: input.oneTimeTime,
    }, timezone, now);
    if (!nextRunAt) throw new AutomationValidationError('INVALID_SCHEDULE', 'A execução única precisa estar no futuro.');
    return {
      name, type: input.type, isActive: input.isActive, messageBody, scheduleType: input.scheduleType,
      oneTimeDate: input.oneTimeDate, oneTimeTime: input.oneTimeTime, weekdays: [] as AutomationWeekday[], times: [], recipientIds, nextRunAt,
    };
  }

  const weekdays = uniqueStrings(input.weekdays, 'Dias') as AutomationWeekday[];
  if (!weekdays.length || weekdays.length > 7 || weekdays.some((day) => !WEEKDAYS.has(day))) {
    throw new AutomationValidationError('INVALID_SCHEDULE', 'Selecione de 1 a 7 dias válidos.');
  }
  const submittedTimes = Array.isArray(input.times) && input.times.every((time) => typeof time === 'string')
    ? input.times.map((time) => time.trim()).filter(Boolean)
    : [];
  const times = uniqueStrings(input.times, 'Horários').sort();
  if (submittedTimes.length !== times.length) {
    throw new AutomationValidationError('INVALID_SCHEDULE', 'Horários duplicados não são permitidos.');
  }
  if (!times.length || times.length > MAX_WEEKLY_TIMES || times.some((time) => !validTime(time))) {
    throw new AutomationValidationError('INVALID_SCHEDULE', `Informe de 1 a ${MAX_WEEKLY_TIMES} horários válidos e sem duplicidade.`);
  }
  const nextRunAt = nextScheduledRun({ scheduleType: 'WEEKLY', weekdays, times }, timezone, now);
  if (!nextRunAt) throw new AutomationValidationError('INVALID_SCHEDULE', 'Não foi possível calcular a próxima execução.');
  return {
    name, type: input.type, isActive: input.isActive, messageBody, scheduleType: input.scheduleType,
    oneTimeDate: null, oneTimeTime: null, weekdays, times, recipientIds, nextRunAt,
  };
}

const automationInclude = {
  variations: { orderBy: [{ normalizedValue: 'asc' as const }, { id: 'asc' as const }] },
  recipients: { include: { customer: true }, orderBy: { createdAt: 'asc' as const } },
  runs: { orderBy: { scheduledFor: 'desc' as const }, take: 10 },
} satisfies Prisma.AutomationInclude;

export class AutomationService implements InboundAutomationMatcher {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
    private readonly timezone: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async list() {
    return this.prisma.automation.findMany({
      where: { companyId: this.companyId, deletedAt: null }, include: automationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  public async get(id: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id, companyId: this.companyId, deletedAt: null }, include: automationInclude,
    });
    if (!automation) throw new AutomationNotFoundError();
    return automation;
  }

  public async create(input: AutomationInput) {
    const data = validateAutomationInput(input, this.timezone, this.clock());
    if (data.type === 'SCHEDULED') await this.assertRecipients(data.recipientIds);
    return this.prisma.automation.create({
      data: data.type === 'INBOUND' ? {
        company: { connect: { id: this.companyId } },
        name: data.name, type: 'INBOUND', isActive: data.isActive,
        responseBody: data.responseBody,
        variations: { create: data.variations },
      } : {
        company: { connect: { id: this.companyId } },
        name: data.name, type: 'SCHEDULED', isActive: data.isActive,
        messageBody: data.messageBody, scheduleType: data.scheduleType,
        oneTimeDate: data.oneTimeDate, oneTimeTime: data.oneTimeTime,
        weekdays: data.weekdays as Weekday[], times: data.times,
        nextRunAt: data.isActive ? data.nextRunAt : null,
        recipients: { create: data.recipientIds.map((customerId) => ({
          customer: { connect: { companyId_id: { companyId: this.companyId, id: customerId } } },
        })) },
      },
      include: automationInclude,
    });
  }

  public async update(id: string, input: AutomationInput) {
    const existing = await this.get(id);
    if (existing.type !== input.type) {
      throw new AutomationValidationError('TYPE_IMMUTABLE', 'O tipo da automação não pode ser alterado.');
    }
    const data = validateAutomationInput(input, this.timezone, this.clock());
    if (data.type === 'SCHEDULED') await this.assertRecipients(data.recipientIds);
    return this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.automation.findFirst({ where: { id, companyId: this.companyId, deletedAt: null }, select: { id: true } });
      if (!owned) throw new AutomationNotFoundError();
      await transaction.automationVariation.deleteMany({ where: { companyId: this.companyId, automationId: id } });
      await transaction.automationRecipient.deleteMany({ where: { companyId: this.companyId, automationId: id } });
      return transaction.automation.update({
        where: { companyId_id: { companyId: this.companyId, id } },
        data: data.type === 'INBOUND' ? {
          name: data.name, isActive: data.isActive, responseBody: data.responseBody,
          variations: { create: data.variations },
        } : {
          name: data.name, isActive: data.isActive, messageBody: data.messageBody,
          scheduleType: data.scheduleType, oneTimeDate: data.oneTimeDate, oneTimeTime: data.oneTimeTime,
          weekdays: data.weekdays as Weekday[], times: data.times,
          scheduleVersion: { increment: 1 }, processingStartedAt: null,
          nextRunAt: data.isActive ? data.nextRunAt : null,
          recipients: { create: data.recipientIds.map((customerId) => ({
            customer: { connect: { companyId_id: { companyId: this.companyId, id: customerId } } },
          })) },
        },
        include: automationInclude,
      });
    });
  }

  public async setActive(id: string, isActive: boolean) {
    const existing = await this.get(id);
    let nextRunAt = existing.nextRunAt;
    if (existing.type === 'SCHEDULED') {
      nextRunAt = isActive ? nextScheduledRun({
        scheduleType: existing.scheduleType!, oneTimeDate: existing.oneTimeDate,
        oneTimeTime: existing.oneTimeTime, weekdays: existing.weekdays, times: existing.times,
      }, this.timezone, this.clock()) : null;
    }
    return this.prisma.automation.update({
      where: { companyId_id: { companyId: this.companyId, id } },
      data: { isActive, nextRunAt, processingStartedAt: null, ...(existing.type === 'SCHEDULED' ? { scheduleVersion: { increment: 1 } } : {}) },
      include: automationInclude,
    });
  }

  public async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.automation.update({
      where: { companyId_id: { companyId: this.companyId, id } },
      data: { isActive: false, nextRunAt: null, processingStartedAt: null, deletedAt: this.clock(), scheduleVersion: { increment: 1 } },
    });
  }

  public async findReply(text: string): Promise<string | null> {
    const normalized = normalizeInboundText(text);
    if (!normalized) return null;
    const rows = await this.prisma.automationVariation.findMany({
      where: { companyId: this.companyId, automation: { type: 'INBOUND', isActive: true, deletedAt: null, company: { status: 'ACTIVE' } } },
      select: { id: true, normalizedValue: true, automation: { select: { id: true, responseBody: true, createdAt: true } } },
    });
    const matches = rows.filter((row) => phraseMatches(normalized, row.normalizedValue));
    matches.sort((left, right) => {
      const exact = Number(normalized === right.normalizedValue) - Number(normalized === left.normalizedValue);
      if (exact) return exact;
      const specificity = right.normalizedValue.length - left.normalizedValue.length;
      if (specificity) return specificity;
      const created = left.automation.createdAt.getTime() - right.automation.createdAt.getTime();
      if (created) return created;
      const automation = left.automation.id.localeCompare(right.automation.id);
      return automation || left.id.localeCompare(right.id);
    });
    return matches[0]?.automation.responseBody ?? null;
  }

  public async createManualCustomer(nameValue: unknown, phoneValue: unknown) {
    const name = requiredText(nameValue, 'Nome', 100);
    if (typeof phoneValue !== 'string') throw new AutomationValidationError('INVALID_PHONE', 'Informe o WhatsApp.');
    const externalId = normalizeWhatsAppNumber(phoneValue);
    const existing = await this.prisma.customer.findUnique({ where: { companyId_externalId: { companyId: this.companyId, externalId } } });
    const customer = existing
      ? await this.prisma.customer.update({ where: { companyId_externalId: { companyId: this.companyId, externalId } }, data: { name } })
      : await this.prisma.customer.create({ data: { companyId: this.companyId, externalId, name } });
    const appointmentCount = await this.prisma.appointment.count({ where: { companyId: this.companyId, customerId: customer.id } });
    return { ...customer, appointmentCount };
  }

  private async assertRecipients(ids: string[]): Promise<void> {
    const count = await this.prisma.customer.count({ where: { companyId: this.companyId, id: { in: ids } } });
    if (count !== ids.length) throw new AutomationValidationError('INVALID_RECIPIENTS', 'Um ou mais contatos não pertencem a esta empresa.');
  }
}
