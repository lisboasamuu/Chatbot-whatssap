import type { PlatformAdminRepository } from './platform-admin.repository.js';
import type {
  BusinessHourInput, CompanySettingsInput, CompanyStatus, DepositType,
  MessageTemplateInput, MessageTemplateType, PlatformCompanyDetail, Weekday,
} from './platform-admin.types.js';

const WEEKDAYS = new Set<Weekday>(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']);
const TEMPLATE_TYPES = new Set<MessageTemplateType>([
  'WELCOME','APPOINTMENT_CREATED','APPOINTMENT_CANCELLED','APPOINTMENT_RESCHEDULED','NO_APPOINTMENTS','BUSINESS_CLOSED',
]);
const STATUS = new Set<CompanyStatus>(['ACTIVE','INACTIVE']);
const DEPOSIT_TYPES = new Set<DepositType>(['NONE','FIXED','PERCENTAGE']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALLOWED_PLACEHOLDERS = new Set(['date', 'time']);

export class PlatformValidationError extends Error {}
export class PlatformNotFoundError extends Error {}

function assertTimezone(timezone: string): void {
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(new Date()); }
  catch { throw new PlatformValidationError('Timezone inválido. Use um identificador IANA, como America/Sao_Paulo.'); }
}
function cleanName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : '';
  if (name.length < 2 || name.length > 120) throw new PlatformValidationError('Nome da empresa deve ter entre 2 e 120 caracteres.');
  return name;
}
function validateTemplateBody(body: string): string {
  const normalized = body.trim();
  if (!normalized || normalized.length > 2000) throw new PlatformValidationError('Mensagem deve ter entre 1 e 2000 caracteres.');
  for (const match of normalized.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (!ALLOWED_PLACEHOLDERS.has(match[1])) throw new PlatformValidationError(`Placeholder não permitido: ${match[1]}.`);
  }
  return normalized;
}

export class PlatformAdminService {
  public constructor(private readonly repository: PlatformAdminRepository) {}
  public listCompanies() { return this.repository.listCompanies(); }
  public getSummary() { return this.repository.getTotals(); }
  public async getCompany(id: string): Promise<PlatformCompanyDetail> {
    const found = await this.repository.getCompany(id);
    if (!found) throw new PlatformNotFoundError('Empresa não encontrada.');
    return found;
  }
  public async createCompany(input: { name?: unknown; timezone?: unknown }): Promise<PlatformCompanyDetail> {
    const name = cleanName(input.name);
    const timezone = typeof input.timezone === 'string' && input.timezone.trim() ? input.timezone.trim() : 'America/Sao_Paulo';
    assertTimezone(timezone);
    return this.repository.createCompany({ name, timezone });
  }
  public async updateCompany(id: string, input: { name?: unknown; timezone?: unknown; status?: unknown }): Promise<PlatformCompanyDetail> {
    const update: { name?: string; timezone?: string; status?: CompanyStatus } = {};
    if (input.name !== undefined) update.name = cleanName(input.name);
    if (input.timezone !== undefined) {
      if (typeof input.timezone !== 'string' || !input.timezone.trim()) throw new PlatformValidationError('Timezone inválido.');
      update.timezone = input.timezone.trim(); assertTimezone(update.timezone);
    }
    if (input.status !== undefined) {
      if (typeof input.status !== 'string' || !STATUS.has(input.status as CompanyStatus)) throw new PlatformValidationError('Status inválido.');
      update.status = input.status as CompanyStatus;
    }
    const found = await this.repository.updateCompany(id, update);
    if (!found) throw new PlatformNotFoundError('Empresa não encontrada.');
    return found;
  }
  public async replaceBusinessHours(id: string, raw: unknown): Promise<PlatformCompanyDetail> {
    if (!Array.isArray(raw)) throw new PlatformValidationError('Horários devem ser uma lista.');
    const hours: BusinessHourInput[] = raw.map((item) => {
      if (!item || typeof item !== 'object') throw new PlatformValidationError('Período inválido.');
      const r = item as Record<string, unknown>;
      if (typeof r.weekday !== 'string' || !WEEKDAYS.has(r.weekday as Weekday) || typeof r.startTime !== 'string' || typeof r.endTime !== 'string' || !TIME_RE.test(r.startTime) || !TIME_RE.test(r.endTime) || r.startTime >= r.endTime) {
        throw new PlatformValidationError('Cada período deve ter dia válido e início menor que fim.');
      }
      return { weekday: r.weekday as Weekday, startTime: r.startTime, endTime: r.endTime };
    });
    for (const day of WEEKDAYS) {
      const periods = hours.filter(h => h.weekday === day).sort((a,b)=>a.startTime.localeCompare(b.startTime));
      for (let i=1;i<periods.length;i++) if (periods[i]!.startTime < periods[i-1]!.endTime) throw new PlatformValidationError(`Horários sobrepostos em ${day}.`);
    }
    if (!(await this.repository.replaceBusinessHours(id, hours))) throw new PlatformNotFoundError('Empresa não encontrada.');
    return this.getCompany(id);
  }
  public async replaceMessageTemplates(id: string, raw: unknown): Promise<PlatformCompanyDetail> {
    if (!Array.isArray(raw)) throw new PlatformValidationError('Mensagens devem ser uma lista.');
    const seen = new Set<string>();
    const templates: MessageTemplateInput[] = raw.map((item) => {
      if (!item || typeof item !== 'object') throw new PlatformValidationError('Mensagem inválida.');
      const r=item as Record<string,unknown>;
      if (typeof r.type !== 'string' || !TEMPLATE_TYPES.has(r.type as MessageTemplateType) || typeof r.body !== 'string' || seen.has(r.type)) throw new PlatformValidationError('Tipo de mensagem inválido ou duplicado.');
      seen.add(r.type); return { type:r.type as MessageTemplateType, body:validateTemplateBody(r.body) };
    });
    if (!(await this.repository.replaceMessageTemplates(id, templates))) throw new PlatformNotFoundError('Empresa não encontrada.');
    return this.getCompany(id);
  }
  public async updateSettings(id: string, raw: unknown): Promise<PlatformCompanyDetail> {
    if (!raw || typeof raw !== 'object') throw new PlatformValidationError('Configuração inválida.');
    const r=raw as Record<string,unknown>;
    if (typeof r.pixEnabled !== 'boolean' || typeof r.depositType !== 'string' || !DEPOSIT_TYPES.has(r.depositType as DepositType)) throw new PlatformValidationError('Configuração Pix/antecipação inválida.');
    const nullableText=(v:unknown,name:string):string|null => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v !== 'string' || v.trim().length > 200) throw new PlatformValidationError(`${name} inválido.`);
      return v.trim();
    };
    const depositType=r.depositType as DepositType;
    let depositValue:number|null=null;
    if (depositType !== 'NONE') {
      if (!Number.isInteger(r.depositValue) || (r.depositValue as number) <= 0) throw new PlatformValidationError('Valor de antecipação inválido.');
      depositValue=r.depositValue as number;
      if (depositType==='PERCENTAGE' && depositValue > 10000) throw new PlatformValidationError('Percentual deve estar entre 0,01% e 100%.');
    }
    const settings:CompanySettingsInput={
      pixEnabled:r.pixEnabled,
      pixKey:nullableText(r.pixKey,'Chave Pix'),
      pixRecipientName:nullableText(r.pixRecipientName,'Favorecido'),
      depositType, depositValue,
    };
    if (settings.pixEnabled && (!settings.pixKey || !settings.pixRecipientName)) throw new PlatformValidationError('Chave Pix e favorecido são obrigatórios quando Pix está habilitado.');
    if (!(await this.repository.upsertSettings(id,settings))) throw new PlatformNotFoundError('Empresa não encontrada.');
    return this.getCompany(id);
  }
}
