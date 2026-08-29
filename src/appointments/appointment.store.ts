import type {
  Appointment,
  CreateAppointmentInput,
} from './appointment.types.js';

export class AppointmentSlotUnavailableError extends Error {
  public constructor() {
    super('Appointment slot is unavailable.');
    this.name = 'AppointmentSlotUnavailableError';
  }
}

export interface AppointmentStore {
  create(input: CreateAppointmentInput): Promise<Appointment>;
  listByCustomer(customerId: string): Promise<Appointment[]>;
  deleteForCustomer(
    appointmentId: string,
    customerId: string,
  ): Promise<boolean>;
  rescheduleForCustomer(
    appointmentId: string,
    customerId: string,
    date: string,
    time: string,
  ): Promise<Appointment | null>;
}
