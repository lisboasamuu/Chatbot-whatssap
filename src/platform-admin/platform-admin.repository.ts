import type {
  BusinessHourInput, CompanySettingsInput, MessageTemplateInput, PlatformCompanyDetail,
  PlatformCompanySummary, CompanyStatus, ReminderConfigurationInput,
} from './platform-admin.types.js';

export interface PlatformAdminRepository {
  listCompanies(): Promise<PlatformCompanySummary[]>;
  getCompany(companyId: string): Promise<PlatformCompanyDetail | null>;
  createCompany(input: { name: string; timezone: string }): Promise<PlatformCompanyDetail>;
  updateCompany(companyId: string, input: { name?: string; timezone?: string; status?: CompanyStatus }): Promise<PlatformCompanyDetail | null>;
  replaceBusinessHours(companyId: string, hours: BusinessHourInput[]): Promise<boolean>;
  replaceMessageTemplates(companyId: string, templates: MessageTemplateInput[]): Promise<boolean>;
  upsertSettings(companyId: string, settings: CompanySettingsInput): Promise<boolean>;
  updateReminderConfiguration(
    companyId: string,
    configuration: ReminderConfigurationInput,
  ): Promise<boolean>;
  upsertCompanyAccess(companyId: string, email: string, passwordHash: string | null): Promise<boolean>;
  getTotals(): Promise<{ totalCompanies: number; activeCompanies: number; inactiveCompanies: number; totalAppointments: number }>;
}
