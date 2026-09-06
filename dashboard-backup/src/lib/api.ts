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
  AuthenticatedCompany,
  CompanyConfiguration,
  WhatsAppStatus,
} from '../types';

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/platform/') && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event('company-session-expired'));
    }
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

  companySession: (): Promise<AuthenticatedCompany> =>
    request<{authenticated:boolean;company:AuthenticatedCompany}>('/api/auth/session').then(({company})=>company),
  companyLogin: (email:string,password:string): Promise<AuthenticatedCompany> =>
    request<{authenticated:boolean;company:AuthenticatedCompany}>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})}).then(({company})=>company),
  companyLogout: (): Promise<void> => request('/api/auth/logout',{method:'POST'}).then(()=>undefined),
  getCompanyConfiguration: (): Promise<CompanyConfiguration> =>
    request<{configuration:CompanyConfiguration}>('/api/company/configuration').then(({configuration})=>configuration),
  saveOwnBusinessHours: (hours:BusinessHour[]): Promise<BusinessHour[]> =>
    request<{businessHours:BusinessHour[]}>('/api/company/business-hours',{method:'PUT',body:JSON.stringify({hours})}).then(({businessHours})=>businessHours),
  saveOwnMessageTemplates: (templates:MessageTemplate[]): Promise<MessageTemplate[]> =>
    request<{messageTemplates:MessageTemplate[]}>('/api/company/messages',{method:'PUT',body:JSON.stringify({templates})}).then(({messageTemplates})=>messageTemplates),
  saveOwnSettings: (settings:CompanySettings): Promise<CompanySettings> =>
    request<{settings:CompanySettings}>('/api/company/settings',{method:'PUT',body:JSON.stringify(settings)}).then(({settings})=>settings),
  saveOwnReminders: (input:{enabled:boolean;offsets:ReminderOffsetMinutes[];message:string|null}): Promise<{reminders:{enabled:boolean;offsets:ReminderOffsetMinutes[]};messageTemplates:MessageTemplate[]}> =>
    request('/api/company/reminders',{method:'PUT',body:JSON.stringify(input)}),
  getWhatsAppStatus: (): Promise<WhatsAppStatus> => request<{status:WhatsAppStatus}>('/api/whatsapp/status').then(({status})=>status),
  getWhatsAppQr: (): Promise<{status:WhatsAppStatus;qr:string|null}> => request('/api/whatsapp/qr'),
  connectWhatsApp: (): Promise<WhatsAppStatus> => request<{status:WhatsAppStatus}>('/api/whatsapp/connect',{method:'POST'}).then(({status})=>status),
  disconnectWhatsApp: (): Promise<WhatsAppStatus> => request<{status:WhatsAppStatus}>('/api/whatsapp/disconnect',{method:'POST'}).then(({status})=>status),

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
  saveCompanyAccess: (id:string,input:{email:string;password:string}): Promise<PlatformCompanyDetail> =>
    request<{company:PlatformCompanyDetail}>(`/api/platform/companies/${encodeURIComponent(id)}/access`,{method:'PUT',body:JSON.stringify(input)}).then(({company})=>company),
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
