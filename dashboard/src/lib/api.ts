import type {
  Appointment,
  Company,
  Conversation,
  Customer,
  CustomerDetail,
  DashboardSummary,
} from '../types';

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    let message = 'Não foi possível carregar os dados.';
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Mantém mensagem genérica quando a resposta não é JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  getCurrentCompany: (): Promise<Company> =>
    request<{ company: Company }>('/api/company/current').then(({ company }) => company),
  getSummary: (): Promise<DashboardSummary> =>
    request<DashboardSummary>('/api/dashboard/summary'),
  getUpcomingAppointments: (): Promise<Appointment[]> =>
    request<{ appointments: Appointment[] }>('/api/appointments/upcoming').then(
      ({ appointments }) => appointments,
    ),
  getCustomers: (): Promise<Customer[]> =>
    request<{ customers: Customer[] }>('/api/customers').then(
      ({ customers }) => customers,
    ),
  getCustomer: (customerId: string): Promise<CustomerDetail> =>
    request<{ customer: CustomerDetail }>(
      `/api/customers/${encodeURIComponent(customerId)}`,
    ).then(({ customer }) => customer),
  getConversation: (customerId: string): Promise<Conversation | null> =>
    request<{ conversation: Conversation | null }>(
      `/api/customers/${encodeURIComponent(customerId)}/conversation`,
    ).then(({ conversation }) => conversation),
};
