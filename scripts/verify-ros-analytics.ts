import assert from 'node:assert/strict';
import {
  buildDailyHourlySales,
  calculateLineFinancials,
  getKitchenPrepMinutes,
  getZonedDateHour,
  summarizeTableSessions
} from '../src/reports/ros-analytics';
import { redactDiagnosticTextForTest } from '../src/reports/ros-diagnostics';

assert.equal(calculateLineFinancials(120, null, 2)?.recordedContributionMarginValue, null);
assert.equal(calculateLineFinancials(120, 70, 2)?.recordedContributionMarginValue, 100);
assert.equal(calculateLineFinancials(0, 0, 1)?.grossItemValue, 0);
assert.equal(getKitchenPrepMinutes('2026-11-16T10:00:00Z', '2026-11-16T10:07:30Z'), 7.5);
assert.equal(getKitchenPrepMinutes('2026-11-16T10:00:00Z', null), null);
assert.equal(getKitchenPrepMinutes('2026-11-16T10:10:00Z', '2026-11-16T10:00:00Z'), null);
assert.deepEqual(getZonedDateHour('2026-11-16T23:30:00Z', 'Africa/Algiers'), { date: '2026-11-17', hour: 0 });

const hourly = buildDailyHourlySales(
  [{ id: 'o1', closedAt: '2026-11-16T19:15:00Z', covers: 2 }],
  [{ orderId: 'o1', quantity: 2, unitPriceSnapshot: 100 }],
  '2026-11-16T00:00:00Z',
  '2026-11-16T23:59:59Z',
  'Africa/Algiers'
);
assert.equal(hourly.find(row => row.date === '2026-11-16' && row.hour === 20)?.grossRecordedItemValue, 200);
assert.equal(hourly.length, 48);

const turns = summarizeTableSessions([
  { createdAt: '2026-11-16T10:00:00Z', closedAt: '2026-11-16T11:00:00Z' },
  { createdAt: '2026-11-16T10:00:00Z', closedAt: null },
  { createdAt: '2026-11-16T10:00:00Z', closedAt: '2026-11-17T01:00:00Z' }
], 'Africa/Algiers');
assert.equal(turns.measuredSessionCount, 1);
assert.equal(turns.averageTurnTimeMinutes, 60);
assert.equal(turns.overThresholdSessionCount, 1);

const redacted = redactDiagnosticTextForTest('Authorization: Bearer abc123 password=hunter2');
assert.match(redacted, /REDACTED/);
assert.doesNotMatch(redacted, /abc123|hunter2/);
console.log('ROS analytics and diagnostics checks passed.');
