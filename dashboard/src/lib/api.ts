import type {
  Appointment,
  Company,
  Conversation,
  Customer,
  CustomerDetail,
  DashboardSummary,
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformSummary,
  BusinessHour,
  MessageTemplate,
  CompanySettings,
  ReminderOffsetMinutes,
} from '../types';

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
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

  platformSession: (): Promise<boolean> =>
    request<{ authenticated: boolean }>('/api/platform/auth/session').then(({authenticated})=>authenticated),
  platformLogin: (password:string): Promise<void> =>
    request('/api/platform/auth/login',{method:'POST',body:JSON.stringify({password})}).then(()=>undefined),
  platformLogout: (): Promise<void> =>
    request('/api/platform/auth/logout',{method:'POST'}).then(()=>undefined),
  getPlatformSummary: (): Promise<PlatformSummary> => request('/api/platform/summary'),
  getCompanies: (): Promise<PlatformCompany[]> =>
    request<{companies:PlatformCompany[]}>('/api/platform/companies').then(({companies})=>companies),
  createCompany: (input:{name:string;timezone:string}): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>('/api/platform/companies',{method:'POST',body:JSON.stringify(input)}).then(({company})=>company),
  getPlatformCompany: (id:string): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}`).then(({company})=>company),
  updatePlatformCompany: (id:string,input:Partial<Pick<PlatformCompanyDetail,'name'|'timezone'|'status'>>): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(input)}).then(({company})=>company),
  saveBusinessHours: (id:string,hours:BusinessHour[]): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}/business-hours`,{method:'PUT',body:JSON.stringify({hours})}).then(({company})=>company),
  saveMessageTemplates: (id:string,templates:MessageTemplate[]): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}/messages`,{method:'PUT',body:JSON.stringify({templates})}).then(({company})=>company),
  saveCompanySettings: (id:string,settings:CompanySettings): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}/settings`,{method:'PUT',body:JSON.stringify(settings)}).then(({company})=>company),
  saveReminderConfiguration: (id:string,input:{enabled:boolean;offsets:ReminderOffsetMinutes[];message:string|null}): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}/reminders`,{method:'PUT',body:JSON.stringify(input)}).then(({company})=>company),
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
