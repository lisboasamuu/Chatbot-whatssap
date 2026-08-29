import type {
  AdminAppointment,
  AdminConversation,
  AdminCustomer,
  AdminCustomerDetail,
} from './admin.types.js';

export interface AdminRepository {
  countCustomers(): Promise<number>;
  countAppointmentsOnDate(date: string): Promise<number>;
  countUpcomingAppointments(date: string, time: string): Promise<number>;
  listUpcomingAppointments(
    date: string,
    time: string,
    limit: number,
  ): Promise<AdminAppointment[]>;
  listCustomers(): Promise<AdminCustomer[]>;
  findCustomerById(customerId: string): Promise<AdminCustomerDetail | null>;
  findConversationByCustomerId(
    customerId: string,
  ): Promise<AdminConversation | null>;
}
