import type { PrismaClient } from '@prisma/client';
import type { MessageTemplateType } from '../platform-admin/platform-admin.types.js';

const DAY_BY_INDEX = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'] as const;

export interface CompanyOperationalConfig {
  status: 'ACTIVE' | 'INACTIVE';
  timezone: string;
}

export class CompanyInactiveError extends Error {
  public constructor() {
    super('Company is inactive.');
    this.name = 'CompanyInactiveError';
  }
}

export class PrismaCompanyConfigService {
  public constructor(private readonly prisma: PrismaClient, private readonly companyId: string) {}

  public async getOperationalConfig(): Promise<CompanyOperationalConfig> {
    const company = await this.prisma.company.findUnique({
      where: { id: this.companyId },
      select: { status: true, timezone: true },
    });
    if (!company) throw new Error('Company not found.');
    return { status: company.status, timezone: company.timezone };
  }

  public async isActive(): Promise<boolean> {
    return (await this.getOperationalConfig()).status === 'ACTIVE';
  }

  public async assertActive(): Promise<void> {
    if (!(await this.isActive())) throw new CompanyInactiveError();
  }

  public async isSlotWithinBusinessHours(date: string, time: string): Promise<boolean> {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = DAY_BY_INDEX[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()]!;
    const periods = await this.prisma.businessHour.findMany({
      where: { companyId: this.companyId, weekday },
      select: { startTime: true, endTime: true },
    });
    return periods.some((period) => time >= period.startTime && time < period.endTime);
  }

  public async getMessageTemplate(type: MessageTemplateType): Promise<string | null> {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { companyId_type: { companyId: this.companyId, type } },
      select: { body: true },
    });
    return template?.body ?? null;
  }
}
