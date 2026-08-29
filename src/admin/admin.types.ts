export interface AdminAppointment {
  id: string;
  customerId: string;
  customerExternalId: string;
  customerName: string | null;
  date: string;
  time: string;
}

export interface AdminCustomer {
  id: string;
  externalId: string;
  name: string | null;
  createdAt: Date;
  appointmentCount: number;
}

export interface AdminCustomerDetail extends AdminCustomer {
  updatedAt: Date;
  appointments: AdminAppointment[];
}

export interface AdminMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: Date;
}

export interface AdminConversation {
  id: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  messages: AdminMessage[];
}

export interface DashboardSummary {
  totalCustomers: number;
  appointmentsToday: number;
  upcomingAppointments: number;
  nextAppointments: AdminAppointment[];
}
