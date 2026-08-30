import type {
  AdminAppointment,
  AdminConversation,
  AdminCustomer,
  AdminCustomerDetail,
} from './admin.types.js';

export interface AdminRepository {
  countCustomers(companyId: string): Promise<number>;
  countAppointmentsOnDate(companyId: string, date: string): Promise<number>;
  countUpcomingAppointments(companyId: string, date: string, time: string): Promise<number>;
  listUpcomingAppointments(
    companyId: string,
    date: string,
    time: string,
    limit: number,
  ): Promise<AdminAppointment[]>;
  listCustomers(companyId: string): Promise<AdminCustomer[]>;
  findCustomerById(
    companyId: string,
    customerId: string,
  ): Promise<AdminCustomerDetail | null>;
  findConversationByCustomerId(
    companyId: string,
    customerId: string,
  ): Promise<AdminConversation | null>;
}
