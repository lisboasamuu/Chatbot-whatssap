export interface Appointment {
  id: string;
  customerId: string;
  customerExternalId: string;
  date: string;
  time: string;
}

export interface Customer {
  id: string;
  externalId: string;
  createdAt: string;
  appointmentCount: number;
}

export interface CustomerDetail extends Customer {
  updatedAt: string;
  appointments: Appointment[];
}

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface DashboardSummary {
  totalCustomers: number;
  appointmentsToday: number;
  upcomingAppointments: number;
  nextAppointments: Appointment[];
}
