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

export interface AppointmentAvailabilityPolicy {
  isSlotWithinBusinessHours(date: string, time: string): Promise<boolean>;
  assertActive(): Promise<void>;
}

export type CreateAppointmentResult =
  | { status: 'CREATED'; appointment: Appointment }
  | { status: 'SLOT_UNAVAILABLE' }
  | { status: 'INVALID_SLOT' }
  | { status: 'OUTSIDE_BUSINESS_HOURS' };

export type CancelAppointmentResult =
  | { status: 'CANCELLED' }
  | { status: 'NOT_FOUND' };

export type RescheduleAppointmentResult =
  | { status: 'RESCHEDULED'; appointment: Appointment }
  | { status: 'SLOT_UNAVAILABLE' }
  | { status: 'INVALID_SLOT' }
  | { status: 'OUTSIDE_BUSINESS_HOURS' }
  | { status: 'NOT_FOUND' };

const systemClock: Clock = () => new Date();

export class AppointmentService {
  public constructor(
    private readonly store: AppointmentStore,
    private readonly clock: Clock = systemClock,
    private readonly availabilityPolicy?: AppointmentAvailabilityPolicy,
    private readonly timezone?: string,
  ) {}

  private localNowParts(): { date: string; time: string } | null {
    if (!this.timezone) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(this.clock());
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return {
      date: `${value('year')}-${value('month')}-${value('day')}`,
      time: `${value('hour')}:${value('minute')}`,
    };
  }

  public currentLocalDate(): string {
    const local = this.localNowParts();
    if (local) {
      return local.date;
    }

    const now = this.clock();
    const year = String(now.getFullYear()).padStart(4, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  public isDateTodayOrFuture(date: string): boolean {
    const local = this.localNowParts();
    return local ? date >= local.date : isDateTodayOrFuture(date, this.clock());
  }

  public isFutureSlot(date: string, time: string): boolean {
    const local = this.localNowParts();
    return local ? date > local.date || (date === local.date && time > local.time) : isFutureSlot(date, time, this.clock());
  }

  public async create(
    customerId: string,
    customerName: string,
    date: string,
    time: string,
  ): Promise<CreateAppointmentResult> {
    if (!this.isFutureSlot(date, time)) {
      return { status: 'INVALID_SLOT' };
    }
    if (this.availabilityPolicy) {
      await this.availabilityPolicy.assertActive();
      if (!(await this.availabilityPolicy.isSlotWithinBusinessHours(date, time))) {
        return { status: 'OUTSIDE_BUSINESS_HOURS' };
      }
    }

    try {
      const appointment = await this.store.create({
        customerId,
        customerName,
        date,
        time,
      });
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
    if (this.availabilityPolicy) {
      await this.availabilityPolicy.assertActive();
      if (!(await this.availabilityPolicy.isSlotWithinBusinessHours(date, time))) {
        return { status: 'OUTSIDE_BUSINESS_HOURS' };
      }
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
