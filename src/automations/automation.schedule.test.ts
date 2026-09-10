import assert from 'node:assert/strict';
import test from 'node:test';
import { nextScheduledRun } from './automation.schedule.js';

test('calculates a one-time local Sao Paulo schedule in UTC', () => {
  const result = nextScheduledRun(
    { scheduleType: 'ONE_TIME', oneTimeDate: '2030-01-02', oneTimeTime: '09:00' },
    'America/Sao_Paulo',
    new Date('2030-01-01T00:00:00.000Z'),
  );
  assert.equal(result?.toISOString(), '2030-01-02T12:00:00.000Z');
});

test('does not repeat an expired one-time schedule', () => {
  const result = nextScheduledRun(
    { scheduleType: 'ONE_TIME', oneTimeDate: '2030-01-02', oneTimeTime: '09:00' },
    'America/Sao_Paulo',
    new Date('2030-01-02T12:00:00.000Z'),
  );
  assert.equal(result, null);
});

test('supports Sunday in a weekly schedule', () => {
  const result = nextScheduledRun(
    { scheduleType: 'WEEKLY', weekdays: ['SUNDAY'], times: ['09:00'] },
    'America/Sao_Paulo',
    new Date('2030-01-05T12:00:00.000Z'),
  );
  assert.equal(result?.toISOString(), '2030-01-06T12:00:00.000Z');
});

test('supports all seven days and chooses the next configured time', () => {
  const result = nextScheduledRun(
    {
      scheduleType: 'WEEKLY',
      weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      times: ['09:00', '15:00', '18:00'],
    },
    'America/Sao_Paulo',
    new Date('2030-01-01T16:00:00.000Z'),
  );
  assert.equal(result?.toISOString(), '2030-01-01T18:00:00.000Z');
});
