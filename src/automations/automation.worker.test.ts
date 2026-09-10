import assert from 'node:assert/strict';
import test from 'node:test';
import { terminalRunStatus } from './automation.worker.js';

test('run is COMPLETED only when every terminal delivery was sent', () => {
  assert.equal(terminalRunStatus(10, 0), 'COMPLETED');
});

test('run is PARTIAL when some recipients succeed and some fail', () => {
  assert.equal(terminalRunStatus(8, 2), 'PARTIAL');
});

test('run is FAILED when no recipient was sent', () => {
  assert.equal(terminalRunStatus(0, 3), 'FAILED');
});
