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

interface TenantCustomer extends AdminCustomerDetail {
  companyId: string;
}

interface TenantAppointment extends AdminAppointment {
  companyId: string;
}

interface TenantConversation extends AdminConversation {
  companyId: string;
  customerId: string;
}

class TenantAwareMemoryRepository implements AdminRepository {
  public constructor(
    private readonly customers: TenantCustomer[],
    private readonly appointments: TenantAppointment[],
    private readonly conversations: TenantConversation[],
  ) {}

  public async countCustomers(companyId: string): Promise<number> {
    return this.customers.filter((customer) => customer.companyId === companyId).length;
  }

  public async countAppointmentsOnDate(
    companyId: string,
    date: string,
  ): Promise<number> {
    return this.appointments.filter(
      (appointment) =>
        appointment.companyId === companyId && appointment.date === date,
    ).length;
  }

  public async countUpcomingAppointments(
    companyId: string,
    date: string,
    time: string,
  ): Promise<number> {
    return this.upcoming(companyId, date, time).length;
  }

  public async listUpcomingAppointments(
    companyId: string,
    date: string,
    time: string,
    limit: number,
  ): Promise<AdminAppointment[]> {
    return this.upcoming(companyId, date, time)
      .slice(0, limit)
      .map(({ companyId: _companyId, ...appointment }) => appointment);
  }

  public async listCustomers(companyId: string): Promise<AdminCustomer[]> {
    return this.customers
      .filter((customer) => customer.companyId === companyId)
      .map(({ companyId: _companyId, ...customer }) => customer);
  }

  public async findCustomerById(
    companyId: string,
    customerId: string,
  ): Promise<AdminCustomerDetail | null> {
    const customer = this.customers.find(
      (item) => item.companyId === companyId && item.id === customerId,
    );
    if (!customer) {
      return null;
    }
    const { companyId: _companyId, ...detail } = customer;
    return detail;
  }

  public async findConversationByCustomerId(
    companyId: string,
    customerId: string,
  ): Promise<AdminConversation | null> {
    const conversation = this.conversations.find(
      (item) =>
        item.companyId === companyId && item.customerId === customerId,
    );
    if (!conversation) {
      return null;
    }
    const {
      companyId: _companyId,
      customerId: _customerId,
      ...result
    } = conversation;
    return result;
  }

  private upcoming(
    companyId: string,
    date: string,
    time: string,
  ): TenantAppointment[] {
    return this.appointments
      .filter(
        (appointment) =>
          appointment.companyId === companyId &&
          (appointment.date > date ||
            (appointment.date === date && appointment.time >= time)),
      )
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) || left.time.localeCompare(right.time),
      );
  }
}

const now = new Date(2030, 0, 1, 10, 0, 0);
const createdAt = new Date('2029-12-01T12:00:00.000Z');

function appointment(
  companyId: string,
  id: string,
  customerId: string,
  date = '2030-01-02',
): TenantAppointment {
  return {
    companyId,
    id,
    customerId,
    customerExternalId: `${customerId}@c.us`,
    customerName: companyId === 'company-a' ? 'Customer A' : 'Customer B',
    date,
    time: '11:00',
  };
}

const appointmentA = appointment('company-a', 'appointment-a', 'customer-a');
const appointmentB = appointment('company-b', 'appointment-b', 'customer-b');

const customers: TenantCustomer[] = [
  {
    companyId: 'company-a',
    id: 'customer-a',
    externalId: 'same-phone@c.us',
    name: 'Customer A',
    createdAt,
    updatedAt: createdAt,
    appointmentCount: 1,
    appointments: [appointmentA],
  },
  {
    companyId: 'company-b',
    id: 'customer-b',
    externalId: 'same-phone@c.us',
    name: 'Customer B',
    createdAt,
    updatedAt: createdAt,
    appointmentCount: 1,
    appointments: [appointmentB],
  },
];

const conversations: TenantConversation[] = [
  {
    companyId: 'company-a',
    customerId: 'customer-a',
    id: 'conversation-a',
    state: 'ACTIVE',
    createdAt,
    updatedAt: createdAt,
    messages: [
      { id: 'message-a', direction: 'INBOUND', body: 'A', createdAt },
    ],
  },
  {
    companyId: 'company-b',
    customerId: 'customer-b',
    id: 'conversation-b',
    state: 'ACTIVE',
    createdAt,
    updatedAt: createdAt,
    messages: [
      { id: 'message-b', direction: 'INBOUND', body: 'B', createdAt },
    ],
  },
];

function createServices(): {
  companyA: AdminService;
  companyB: AdminService;
  empty: AdminService;
} {
  const repository = new TenantAwareMemoryRepository(
    customers,
    [appointmentA, appointmentB],
    conversations,
  );
  return {
    companyA: new AdminService(
      repository,
      { companyId: 'company-a', companyName: 'Company A' },
      () => now,
    ),
    companyB: new AdminService(
      repository,
      { companyId: 'company-b', companyName: 'Company B' },
      () => now,
    ),
    empty: new AdminService(
      repository,
      { companyId: 'company-empty', companyName: 'Empty Company' },
      () => now,
    ),
  };
}

test('customers list is isolated between companies A and B', async () => {
  const { companyA, companyB } = createServices();

  assert.deepEqual((await companyA.listCustomers()).map(({ id }) => id), [
    'customer-a',
  ]);
  assert.deepEqual((await companyB.listCustomers()).map(({ id }) => id), [
    'customer-b',
  ]);
});

test('customer detail returns own tenant and hides a valid cross-tenant id as 404', async () => {
  const { companyA, companyB } = createServices();

  assert.equal((await companyA.getCustomer('customer-a')).id, 'customer-a');
  assert.equal((await companyB.getCustomer('customer-b')).id, 'customer-b');
  await assert.rejects(
    companyA.getCustomer('customer-b'),
    AdminResourceNotFoundError,
  );
  await assert.rejects(
    companyB.getCustomer('customer-a'),
    AdminResourceNotFoundError,
  );
});

test('appointments are isolated between companies A and B', async () => {
  const { companyA, companyB } = createServices();

  assert.deepEqual(
    (await companyA.listUpcomingAppointments()).map(({ id }) => id),
    ['appointment-a'],
  );
  assert.deepEqual(
    (await companyB.listUpcomingAppointments()).map(({ id }) => id),
    ['appointment-b'],
  );
});

test('conversations and inherited messages are isolated between companies', async () => {
  const { companyA, companyB } = createServices();

  const conversationA = await companyA.getConversation('customer-a');
  const conversationB = await companyB.getConversation('customer-b');

  assert.equal(conversationA?.id, 'conversation-a');
  assert.deepEqual(conversationA?.messages.map(({ id }) => id), ['message-a']);
  assert.equal(conversationB?.id, 'conversation-b');
  assert.deepEqual(conversationB?.messages.map(({ id }) => id), ['message-b']);

  await assert.rejects(
    companyA.getConversation('customer-b'),
    AdminResourceNotFoundError,
  );
  await assert.rejects(
    companyB.getConversation('customer-a'),
    AdminResourceNotFoundError,
  );
});

test('dashboard summary is tenant-scoped and empty company returns zero metrics', async () => {
  const { companyA, companyB, empty } = createServices();

  assert.deepEqual(await companyA.getSummary(), {
    totalCustomers: 1,
    appointmentsToday: 0,
    upcomingAppointments: 1,
    nextAppointments: [appointmentA].map(({ companyId: _companyId, ...item }) => item),
  });
  assert.deepEqual(await companyB.getSummary(), {
    totalCustomers: 1,
    appointmentsToday: 0,
    upcomingAppointments: 1,
    nextAppointments: [appointmentB].map(({ companyId: _companyId, ...item }) => item),
  });
  assert.deepEqual(await empty.getSummary(), {
    totalCustomers: 0,
    appointmentsToday: 0,
    upcomingAppointments: 0,
    nextAppointments: [],
  });
});
