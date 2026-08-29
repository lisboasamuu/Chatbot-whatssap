import assert from 'node:assert/strict';
import test from 'node:test';

import type { AdminRepository } from './admin.repository.js';
import { AdminResourceNotFoundError, AdminService } from './admin.service.js';
import type {
  AdminAppointment,
  AdminConversation,
  AdminCustomer,
  AdminCustomerDetail,
} from './admin.types.js';

class FakeAdminRepository implements AdminRepository {
  public customers: AdminCustomer[] = [];
  public appointments: AdminAppointment[] = [];
  public customerDetails = new Map<string, AdminCustomerDetail>();
  public conversations = new Map<string, AdminConversation | null>();

  public async countCustomers(): Promise<number> {
    return this.customers.length;
  }

  public async countAppointmentsOnDate(date: string): Promise<number> {
    return this.appointments.filter((appointment) => appointment.date === date).length;
  }

  public async countUpcomingAppointments(date: string, time: string): Promise<number> {
    return this.filterUpcoming(date, time).length;
  }

  public async listUpcomingAppointments(
    date: string,
    time: string,
    limit: number,
  ): Promise<AdminAppointment[]> {
    return this.filterUpcoming(date, time)
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) || left.time.localeCompare(right.time),
      )
      .slice(0, limit);
  }

  public async listCustomers(): Promise<AdminCustomer[]> {
    return this.customers;
  }

  public async findCustomerById(
    customerId: string,
  ): Promise<AdminCustomerDetail | null> {
    return this.customerDetails.get(customerId) ?? null;
  }

  public async findConversationByCustomerId(
    customerId: string,
  ): Promise<AdminConversation | null> {
    return this.conversations.get(customerId) ?? null;
  }

  private filterUpcoming(date: string, time: string): AdminAppointment[] {
    return this.appointments.filter(
      (appointment) =>
        appointment.date > date ||
        (appointment.date === date && appointment.time >= time),
    );
  }
}

const now = new Date(2026, 7, 29, 10, 30, 0);

function appointment(
  id: string,
  date: string,
  time: string,
  customerId = 'customer-1',
): AdminAppointment {
  return {
    id,
    customerId,
    customerExternalId: `${customerId}@c.us`,
    customerName: null,
    date,
    time,
  };
}

test('summary returns zero values and empty list for empty repository', async () => {
  const repository = new FakeAdminRepository();
  const service = new AdminService(repository, () => now);

  assert.deepEqual(await service.getSummary(), {
    totalCustomers: 0,
    appointmentsToday: 0,
    upcomingAppointments: 0,
    nextAppointments: [],
  });
});

test('summary calculates real counts and next appointments', async () => {
  const repository = new FakeAdminRepository();
  repository.customers = [
    {
      id: 'customer-1',
      externalId: '5511999999999@c.us',
    name: null,
      createdAt: now,
      appointmentCount: 2,
    },
  ];
  repository.appointments = [
    appointment('past-today', '2026-08-29', '09:00'),
    appointment('today', '2026-08-29', '11:00'),
    appointment('future', '2026-08-30', '08:00'),
  ];
  const service = new AdminService(repository, () => now);

  const summary = await service.getSummary();

  assert.equal(summary.totalCustomers, 1);
  assert.equal(summary.appointmentsToday, 2);
  assert.equal(summary.upcomingAppointments, 2);
  assert.deepEqual(
    summary.nextAppointments.map(({ id }) => id),
    ['today', 'future'],
  );
});

test('upcoming appointments are ordered chronologically', async () => {
  const repository = new FakeAdminRepository();
  repository.appointments = [
    appointment('third', '2026-08-30', '09:00'),
    appointment('second', '2026-08-29', '14:00'),
    appointment('first', '2026-08-29', '11:00'),
  ];
  const service = new AdminService(repository, () => now);

  const result = await service.listUpcomingAppointments();

  assert.deepEqual(
    result.map(({ id }) => id),
    ['first', 'second', 'third'],
  );
});

test('customers are returned from repository', async () => {
  const repository = new FakeAdminRepository();
  repository.customers = [
    {
      id: 'customer-1',
      externalId: '5511999999999@c.us',
    name: null,
      createdAt: now,
      appointmentCount: 3,
    },
  ];
  const service = new AdminService(repository, () => now);

  assert.deepEqual(await service.listCustomers(), repository.customers);
});

test('existing customer includes appointments', async () => {
  const repository = new FakeAdminRepository();
  const detail: AdminCustomerDetail = {
    id: 'customer-1',
    externalId: '5511999999999@c.us',
    name: null,
    createdAt: now,
    updatedAt: now,
    appointmentCount: 1,
    appointments: [appointment('appointment-1', '2026-08-30', '09:00')],
  };
  repository.customerDetails.set(detail.id, detail);
  const service = new AdminService(repository, () => now);

  assert.deepEqual(await service.getCustomer(detail.id), detail);
});

test('missing customer throws resource not found', async () => {
  const service = new AdminService(new FakeAdminRepository(), () => now);

  await assert.rejects(
    service.getCustomer('missing'),
    AdminResourceNotFoundError,
  );
});

test('customer without conversation returns null conversation', async () => {
  const repository = new FakeAdminRepository();
  repository.customerDetails.set('customer-1', {
    id: 'customer-1',
    externalId: '5511999999999@c.us',
    name: null,
    createdAt: now,
    updatedAt: now,
    appointmentCount: 0,
    appointments: [],
  });
  repository.conversations.set('customer-1', null);
  const service = new AdminService(repository, () => now);

  assert.equal(await service.getConversation('customer-1'), null);
});

test('conversation messages preserve chronological repository order', async () => {
  const repository = new FakeAdminRepository();
  repository.customerDetails.set('customer-1', {
    id: 'customer-1',
    externalId: '5511999999999@c.us',
    name: null,
    createdAt: now,
    updatedAt: now,
    appointmentCount: 0,
    appointments: [],
  });
  repository.conversations.set('customer-1', {
    id: 'conversation-1',
    state: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: 'message-1',
        direction: 'INBOUND',
        body: 'Olá',
        createdAt: new Date('2026-08-29T13:00:00.000Z'),
      },
      {
        id: 'message-2',
        direction: 'OUTBOUND',
        body: 'Olá! Como posso ajudar?',
        createdAt: new Date('2026-08-29T13:00:01.000Z'),
      },
    ],
  });
  const service = new AdminService(repository, () => now);

  const conversation = await service.getConversation('customer-1');

  assert.deepEqual(
    conversation?.messages.map(({ direction }) => direction),
    ['INBOUND', 'OUTBOUND'],
  );
});
