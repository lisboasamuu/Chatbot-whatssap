import {
  AppointmentSlotUnavailableError,
  type AppointmentStore,
} from './appointment.store.js';
import {
  isDateTodayOrFuture,
  isFutureSlot,
  type Appointment,
  type Clock,
} from './appointment.types.js';

export type CreateAppointmentResult =
  | { status: 'CREATED'; appointment: Appointment }
  | { status: 'SLOT_UNAVAILABLE' }
  | { status: 'INVALID_SLOT' };

export type CancelAppointmentResult =
  | { status: 'CANCELLED' }
  | { status: 'NOT_FOUND' };

export type RescheduleAppointmentResult =
  | { status: 'RESCHEDULED'; appointment: Appointment }
  | { status: 'SLOT_UNAVAILABLE' }
  | { status: 'INVALID_SLOT' }
  | { status: 'NOT_FOUND' };

const systemClock: Clock = () => new Date();

export class AppointmentService {
  public constructor(
    private readonly store: AppointmentStore,
    private readonly clock: Clock = systemClock,
  ) {}

  public isDateTodayOrFuture(date: string): boolean {
    return isDateTodayOrFuture(date, this.clock());
  }

  public isFutureSlot(date: string, time: string): boolean {
    return isFutureSlot(date, time, this.clock());
  }

  public async create(
    customerId: string,
    date: string,
    time: string,
  ): Promise<CreateAppointmentResult> {
    if (!this.isFutureSlot(date, time)) {
      return { status: 'INVALID_SLOT' };
    }

    try {
      const appointment = await this.store.create({ customerId, date, time });
      return { status: 'CREATED', appointment };
    } catch (error) {
      if (error instanceof AppointmentSlotUnavailableError) {
        return { status: 'SLOT_UNAVAILABLE' };
      }

      throw error;
    }
  }

  public async list(customerId: string): Promise<Appointment[]> {
    const appointments = await this.store.listByCustomer(customerId);
    return [...appointments].sort(
      (left, right) =>
        left.date.localeCompare(right.date) || left.time.localeCompare(right.time),
    );
  }

  public async cancel(
    appointmentId: string,
    customerId: string,
  ): Promise<CancelAppointmentResult> {
    const deleted = await this.store.deleteForCustomer(
      appointmentId,
      customerId,
    );

    return deleted ? { status: 'CANCELLED' } : { status: 'NOT_FOUND' };
  }

  public async reschedule(
    appointmentId: string,
    customerId: string,
    date: string,
    time: string,
  ): Promise<RescheduleAppointmentResult> {
    if (!this.isFutureSlot(date, time)) {
      return { status: 'INVALID_SLOT' };
    }

    try {
      const appointment = await this.store.rescheduleForCustomer(
        appointmentId,
        customerId,
        date,
        time,
      );

      return appointment
        ? { status: 'RESCHEDULED', appointment }
        : { status: 'NOT_FOUND' };
    } catch (error) {
      if (error instanceof AppointmentSlotUnavailableError) {
        return { status: 'SLOT_UNAVAILABLE' };
      }

      throw error;
    }
  }
}
