import assert from 'node:assert/strict';
import test from 'node:test';

import type { AddressInfo } from 'node:net';

import type { AdminRepository } from './admin.repository.js';
import { createAdminHttpServer } from './admin.http.js';
import { AdminService } from './admin.service.js';
import type {
  AdminAppointment,
  AdminConversation,
  AdminCustomer,
  AdminCustomerDetail,
} from './admin.types.js';

class StubRepository implements AdminRepository {
  public fail = false;

  private maybeFail(): void {
    if (this.fail) {
      throw new Error('sensitive database error');
    }
  }

  public async countCustomers(_companyId: string): Promise<number> {
    this.maybeFail();
    return 0;
  }

  public async countAppointmentsOnDate(_companyId: string, _date: string): Promise<number> {
    this.maybeFail();
    return 0;
  }

  public async countUpcomingAppointments(_companyId: string, _date: string, _time: string): Promise<number> {
    this.maybeFail();
    return 0;
  }

  public async listUpcomingAppointments(_companyId: string, _date: string, _time: string, _limit: number): Promise<AdminAppointment[]> {
    this.maybeFail();
    return [];
  }

  public async listCustomers(_companyId: string): Promise<AdminCustomer[]> {
    this.maybeFail();
    return [];
  }

  public async findCustomerById(
    _companyId: string,
    customerId: string,
  ): Promise<AdminCustomerDetail | null> {
    this.maybeFail();
    if (customerId === 'existing') {
      const createdAt = new Date('2026-08-29T12:00:00.000Z');
      return {
        id: customerId,
        externalId: '5511999999999@c.us',
        name: null,
        createdAt,
        updatedAt: createdAt,
        appointmentCount: 0,
        appointments: [],
      };
    }
    return null;
  }

  public async findConversationByCustomerId(_companyId: string, _customerId: string): Promise<AdminConversation | null> {
    this.maybeFail();
    return null;
  }
}

async function withServer(
  repository: StubRepository,
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createAdminHttpServer(
    new AdminService(
      repository,
      { companyId: 'company-a', companyName: 'Company A' },
      () => new Date(2026, 7, 29, 10, 30),
    ),
  );

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('health endpoint responds with ok JSON', async () => {
  await withServer(new StubRepository(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('current company endpoint exposes only trusted server tenant', async () => {
  await withServer(new StubRepository(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/company/current`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      company: { id: 'company-a', name: 'Company A' },
    });
  });
});

test('missing customer endpoint responds with 404', async () => {
  await withServer(new StubRepository(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customers/missing`);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

test('internal error is controlled and does not expose stack or database detail', async () => {
  const repository = new StubRepository();
  repository.fail = true;

  await withServer(repository, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard/summary`);
    const raw = await response.text();

    assert.equal(response.status, 500);
    assert.match(raw, /INTERNAL_ERROR/);
    assert.doesNotMatch(raw, /sensitive database error/);
    assert.doesNotMatch(raw, /stack/i);
    assert.doesNotMatch(raw, /DATABASE_URL/);
  });
});

test('invalid limit is rejected with 400', async () => {
  await withServer(new StubRepository(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/appointments/upcoming?limit=0`);
    assert.equal(response.status, 400);
  });
});
