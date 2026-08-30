import type { PrismaClient } from '@prisma/client';

import type { AdminRepository } from '../admin/admin.repository.js';
import type {
  AdminAppointment,
  AdminConversation,
  AdminCustomer,
  AdminCustomerDetail,
} from '../admin/admin.types.js';

export class PrismaAdminRepository implements AdminRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public countCustomers(companyId: string): Promise<number> {
    return this.prisma.customer.count({ where: { companyId } });
  }

  public countAppointmentsOnDate(companyId: string, date: string): Promise<number> {
    return this.prisma.appointment.count({ where: { companyId, date } });
  }

  public countUpcomingAppointments(
    companyId: string,
    date: string,
    time: string,
  ): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        companyId,
        OR: [{ date: { gt: date } }, { date, time: { gte: time } }],
      },
    });
  }

  public async listUpcomingAppointments(
    companyId: string,
    date: string,
    time: string,
    limit: number,
  ): Promise<AdminAppointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        OR: [{ date: { gt: date } }, { date, time: { gte: time } }],
      },
      include: {
        customer: { select: { externalId: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: limit,
    });

    return appointments.map((appointment) => ({
      id: appointment.id,
      customerId: appointment.customerId,
      customerExternalId: appointment.customer.externalId,
      customerName: appointment.customer.name,
      date: appointment.date,
      time: appointment.time,
    }));
  }

  public async listCustomers(companyId: string): Promise<AdminCustomer[]> {
    const customers = await this.prisma.customer.findMany({
      where: { companyId },
      include: {
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return customers.map((customer) => ({
      id: customer.id,
      externalId: customer.externalId,
      name: customer.name,
      createdAt: customer.createdAt,
      appointmentCount: customer._count.appointments,
    }));
  }

  public async findCustomerById(
    companyId: string,
    customerId: string,
  ): Promise<AdminCustomerDetail | null> {
    const customer = await this.prisma.customer.findUnique({
      where: {
        companyId_id: { companyId, id: customerId },
      },
      include: {
        appointments: {
          where: { companyId },
          include: {
            customer: { select: { externalId: true, name: true } },
          },
          orderBy: [{ date: 'asc' }, { time: 'asc' }],
        },
        _count: {
          select: { appointments: true },
        },
      },
    });

    if (!customer) {
      return null;
    }

    return {
      id: customer.id,
      externalId: customer.externalId,
      name: customer.name,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      appointmentCount: customer._count.appointments,
      appointments: customer.appointments.map((appointment) => ({
        id: appointment.id,
        customerId: appointment.customerId,
        customerExternalId: appointment.customer.externalId,
        customerName: appointment.customer.name,
        date: appointment.date,
        time: appointment.time,
      })),
    };
  }

  public async findConversationByCustomerId(
    companyId: string,
    customerId: string,
  ): Promise<AdminConversation | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        companyId_customerId: { companyId, customerId },
      },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      state: conversation.state,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt,
      })),
    };
  }
}
