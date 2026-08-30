
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppointmentStore } from './appointment.store.js';
import { AppointmentService } from './appointment.service.js';

test('business-hours policy affects create and reschedule availability', async () => {
const createdAt = new Date('2026-08-30T10:00:00.000Z');
const updatedAt = new Date('2026-08-30T10:00:00.000Z');

const store: AppointmentStore = {
  async create(input) {
    return {
      id: '1',
      customerId: input.customerId,
      date: input.date,
      time: input.time,
      createdAt,
      updatedAt,
    };
  },

  async listByCustomer() {
    return [];
  },

  async deleteForCustomer() {
    return true;
  },

  async rescheduleForCustomer(id, customerId, date, time) {
    return {
      id,
      customerId,
      date,
      time,
      createdAt,
      updatedAt,
    };
  },
};
  const policy = {
    async assertActive(){},
    async isSlotWithinBusinessHours(_date:string,time:string){ return time >= '09:00' && time < '18:00'; },
  };
  const service = new AppointmentService(store, () => new Date('2026-08-30T10:00:00Z'), policy, 'UTC');
  assert.equal((await service.create('c','Cliente','2026-08-31','10:00')).status,'CREATED');
  assert.equal((await service.create('c','Cliente','2026-08-31','20:00')).status,'OUTSIDE_BUSINESS_HOURS');
  assert.equal((await service.reschedule('1','c','2026-08-31','20:00')).status,'OUTSIDE_BUSINESS_HOURS');
});
