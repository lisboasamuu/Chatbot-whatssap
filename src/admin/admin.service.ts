import type { AdminRepository } from './admin.repository.js';
import type {
  AdminAppointment,
  AdminCompany,
  AdminConversation,
  AdminCustomer,
  AdminCustomerDetail,
  DashboardSummary,
} from './admin.types.js';
import type { TenantContext } from '../tenant/tenant.context.js';

export class AdminResourceNotFoundError extends Error {
  public constructor(resource: string) {
    super(`${resource} not found.`);
    this.name = 'AdminResourceNotFoundError';
  }
}

function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export class AdminService {
  public constructor(
    private readonly repository: AdminRepository,
    private readonly tenant: TenantContext,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public getCompany(): AdminCompany {
    return { id: this.tenant.companyId, name: this.tenant.companyName };
  }

  public async getSummary(limit = 5): Promise<DashboardSummary> {
    const now = this.clock();
    const date = formatLocalDate(now);
    const time = formatLocalTime(now);
    const companyId = this.tenant.companyId;

    const [
      totalCustomers,
      appointmentsToday,
      upcomingAppointments,
      nextAppointments,
    ] = await Promise.all([
      this.repository.countCustomers(companyId),
      this.repository.countAppointmentsOnDate(companyId, date),
      this.repository.countUpcomingAppointments(companyId, date, time),
      this.repository.listUpcomingAppointments(companyId, date, time, limit),
    ]);

    return {
      totalCustomers,
      appointmentsToday,
      upcomingAppointments,
      nextAppointments,
    };
  }

  public async listUpcomingAppointments(limit = 100): Promise<AdminAppointment[]> {
    const now = this.clock();
    return this.repository.listUpcomingAppointments(
      this.tenant.companyId,
      formatLocalDate(now),
      formatLocalTime(now),
      limit,
    );
  }

  public async listCustomers(): Promise<AdminCustomer[]> {
    return this.repository.listCustomers(this.tenant.companyId);
  }

  public async getCustomer(customerId: string): Promise<AdminCustomerDetail> {
    const customer = await this.repository.findCustomerById(
      this.tenant.companyId,
      customerId,
    );
    if (!customer) {
      throw new AdminResourceNotFoundError('Customer');
    }
    return customer;
  }

  public async getConversation(customerId: string): Promise<AdminConversation | null> {
    const customer = await this.repository.findCustomerById(
      this.tenant.companyId,
      customerId,
    );
    if (!customer) {
      throw new AdminResourceNotFoundError('Customer');
    }
    return this.repository.findConversationByCustomerId(
      this.tenant.companyId,
      customerId,
    );
  }
}
