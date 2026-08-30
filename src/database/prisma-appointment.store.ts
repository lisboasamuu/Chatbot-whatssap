import { Prisma, type PrismaClient } from '@prisma/client';

import {
  AppointmentSlotUnavailableError,
  type AppointmentStore,
} from '../appointments/appointment.store.js';
import type {
  Appointment,
  CreateAppointmentInput,
} from '../appointments/appointment.types.js';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export class PrismaAppointmentStore implements AppointmentStore {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  public async create(input: CreateAppointmentInput): Promise<Appointment> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: {
            companyId_id: {
              companyId: this.companyId,
              id: input.customerId,
            },
          },
          data: { name: input.customerName },
        });

        return tx.appointment.create({
          data: {
            companyId: this.companyId,
            customerId: input.customerId,
            date: input.date,
            time: input.time,
          },
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppointmentSlotUnavailableError();
      }
      throw error;
    }
  }

  public async listByCustomer(customerId: string): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        companyId: this.companyId,
        customerId,
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  }

  public async deleteForCustomer(
    appointmentId: string,
    customerId: string,
  ): Promise<boolean> {
    const result = await this.prisma.appointment.deleteMany({
      where: {
        id: appointmentId,
        companyId: this.companyId,
        customerId,
      },
    });
    return result.count > 0;
  }

  public async rescheduleForCustomer(
    appointmentId: string,
    customerId: string,
    date: string,
    time: string,
  ): Promise<Appointment | null> {
    try {
      const result = await this.prisma.appointment.updateMany({
        where: {
          id: appointmentId,
          companyId: this.companyId,
          customerId,
        },
        data: { date, time },
      });

      if (result.count === 0) {
        return null;
      }

      return this.prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          companyId: this.companyId,
          customerId,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppointmentSlotUnavailableError();
      }
      throw error;
    }
  }
}
