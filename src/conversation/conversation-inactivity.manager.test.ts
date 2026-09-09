import assert from 'node:assert/strict';
import test from 'node:test';

import { ConversationInactivityManager } from './conversation-inactivity.manager.js';

interface ScheduledTask {
  callback: () => void;
  cancelled: boolean;
}

function createScheduler(): {
  tasks: ScheduledTask[];
  schedule: (
    callback: () => void,
    delayMs: number,
  ) => () => void;
} {
  const tasks: ScheduledTask[] = [];

  return {
    tasks,
    schedule: (callback) => {
      const task = { callback, cancelled: false };
      tasks.push(task);

      return () => {
        task.cancelled = true;
      };
    },
  };
}

test('touch schedules inactivity expiration', async () => {
  const expired: string[] = [];
  const scheduler = createScheduler();
  const manager = new ConversationInactivityManager(
    async (externalUserId) => {
      expired.push(externalUserId);
    },
    300_000,
    scheduler.schedule,
  );

  manager.touch('5511999999999@c.us');

  assert.equal(scheduler.tasks.length, 1);
  scheduler.tasks[0]?.callback();
  await Promise.resolve();

  assert.deepEqual(expired, ['5511999999999@c.us']);
});

test('new inbound activity cancels the previous timeout', async () => {
  const expired: string[] = [];
  const scheduler = createScheduler();
  const manager = new ConversationInactivityManager(
    async (externalUserId) => {
      expired.push(externalUserId);
    },
    300_000,
    scheduler.schedule,
  );

  manager.touch('user-a');
  manager.touch('user-a');

  assert.equal(scheduler.tasks.length, 2);
  assert.equal(scheduler.tasks[0]?.cancelled, true);

  scheduler.tasks[0]?.callback();
  await Promise.resolve();
  assert.deepEqual(expired, []);

  scheduler.tasks[1]?.callback();
  await Promise.resolve();
  assert.deepEqual(expired, ['user-a']);
});

test('cancel prevents inactivity expiration', async () => {
  const expired: string[] = [];
  const scheduler = createScheduler();
  const manager = new ConversationInactivityManager(
    async (externalUserId) => {
      expired.push(externalUserId);
    },
    300_000,
    scheduler.schedule,
  );

  manager.touch('user-a');
  manager.cancel('user-a');

  assert.equal(scheduler.tasks[0]?.cancelled, true);
  scheduler.tasks[0]?.callback();
  await Promise.resolve();

  assert.deepEqual(expired, []);
});

test('destroy cancels all pending timeouts', async () => {
  const expired: string[] = [];
  const scheduler = createScheduler();
  const manager = new ConversationInactivityManager(
    async (externalUserId) => {
      expired.push(externalUserId);
    },
    300_000,
    scheduler.schedule,
  );

  manager.touch('user-a');
  manager.touch('user-b');
  manager.destroy();

  assert.ok(scheduler.tasks.every((task) => task.cancelled));

  for (const task of scheduler.tasks) {
    task.callback();
  }
  await Promise.resolve();

  assert.deepEqual(expired, []);
});

test('rejects invalid timeout configuration', () => {
  assert.throws(
    () =>
      new ConversationInactivityManager(
        async () => undefined,
        0,
      ),
    /timeoutMs must be greater than zero/,
  );
});
