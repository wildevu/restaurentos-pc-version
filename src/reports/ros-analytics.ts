export type DateLike = Date | string | number | null | undefined;

function toValidDate(value: DateLike): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function roundMinutes(value: number): number {
  return Number(value.toFixed(1));
}

export function getZonedDateHour(value: DateLike, timeZone: string): { date: string; hour: number } | null {
  const date = toValidDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = Number(part('hour'));
  if (!year || !month || !day || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return { date: year + '-' + month + '-' + day, hour };
}

function nextDateKey(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  return next.toISOString().slice(0, 10);
}

export function enumerateZonedDates(start: DateLike, end: DateLike, timeZone: string): string[] {
  const startParts = getZonedDateHour(start, timeZone);
  const endParts = getZonedDateHour(end, timeZone);
  if (!startParts || !endParts || startParts.date > endParts.date) return [];
  const dates: string[] = [];
  let cursor = startParts.date;
  while (cursor <= endParts.date && dates.length < 370) {
    dates.push(cursor);
    cursor = nextDateKey(cursor);
  }
  return dates;
}

export interface HourlyOrder {
  id: string;
  closedAt: DateLike;
  covers?: number | null;
}

export interface HourlyOrderItem {
  orderId: string;
  quantity: number;
  unitPriceSnapshot: number;
}

export function calculateLineFinancials(unitPrice: unknown, unitCost: unknown, quantity: unknown) {
  const price = Number(unitPrice);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(qty) || qty <= 0) return null;
  const grossItemValue = price * qty;
  const cost = unitCost === null || unitCost === undefined ? null : Number(unitCost);
  const hasCost = cost !== null && Number.isFinite(cost) && cost >= 0;
  const recordedCostValue = hasCost ? (cost as number) * qty : null;
  return {
    quantity: qty,
    grossItemValue,
    recordedCostValue,
    recordedContributionMarginValue: hasCost ? grossItemValue - (recordedCostValue as number) : null,
    costRecorded: hasCost
  };
}

export function getKitchenPrepMinutes(createdAt: DateLike, firstReadyAt: DateLike): number | null {
  const start = toValidDate(createdAt);
  const end = toValidDate(firstReadyAt);
  if (!start || !end || end.getTime() < start.getTime()) return null;
  return roundMinutes((end.getTime() - start.getTime()) / 60000);
}

export const MAX_TABLE_SESSION_MINUTES = 12 * 60;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeTableSessions(orders: Array<{
  createdAt: DateLike;
  closedAt: DateLike;
}>, timeZone: string) {
  const daily = new Map<string, number[]>();
  const validDurations: number[] = [];
  let missingOpenTimestampCount = 0;
  let invalidDurationCount = 0;
  let overThresholdCount = 0;

  for (const order of orders) {
    const close = toValidDate(order.closedAt);
    const open = toValidDate(order.createdAt);
    if (!close) continue;
    const local = getZonedDateHour(close, timeZone);
    if (!local) continue;
    if (!open) {
      missingOpenTimestampCount++;
      continue;
    }
    const duration = (close.getTime() - open.getTime()) / 60000;
    if (!Number.isFinite(duration) || duration <= 0) {
      invalidDurationCount++;
      continue;
    }
    if (duration > MAX_TABLE_SESSION_MINUTES) {
      overThresholdCount++;
      continue;
    }
    validDurations.push(duration);
    const values = daily.get(local.date) || [];
    values.push(duration);
    daily.set(local.date, values);
  }

  const average = validDurations.length
    ? validDurations.reduce((sum, value) => sum + value, 0) / validDurations.length
    : null;
  const dailyMetrics = Array.from(daily.entries()).map(([date, values]) => ({
    date,
    sessionsMeasured: values.length,
    averageTurnTimeMinutes: roundMinutes(values.reduce((sum, value) => sum + value, 0) / values.length),
    medianTurnTimeMinutes: roundMinutes(median(values) as number)
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    averageTurnTimeMinutes: average === null ? null : roundMinutes(average),
    medianTurnTimeMinutes: median(validDurations) === null ? null : roundMinutes(median(validDurations) as number),
    measuredSessionCount: validDurations.length,
    overThresholdSessionCount: overThresholdCount,
    invalidDurationCount,
    missingOpenTimestampCount,
    dailyMetrics
  };
}

export function buildDailyHourlySales(
  orders: HourlyOrder[],
  items: HourlyOrderItem[],
  start: DateLike,
  end: DateLike,
  timeZone: string
) {
  const dates = enumerateZonedDates(start, end, timeZone);
  const slots = new Map<string, {
    date: string;
    hour: number;
    grossRecordedItemValue: number;
    closedTableSessions: number;
    covers: number;
    itemQuantity: number;
  }>();
  for (const date of dates) {
    for (let hour = 0; hour < 24; hour++) {
      slots.set(date + ':' + hour, {
        date,
        hour,
        grossRecordedItemValue: 0,
        closedTableSessions: 0,
        covers: 0,
        itemQuantity: 0
      });
    }
  }

  const orderSlot = new Map<string, string>();
  for (const order of orders) {
    const local = getZonedDateHour(order.closedAt, timeZone);
    if (!local) continue;
    const key = local.date + ':' + local.hour;
    const slot = slots.get(key);
    if (!slot) continue;
    slot.closedTableSessions++;
    const covers = Number(order.covers);
    if (Number.isFinite(covers) && Number.isInteger(covers) && covers >= 0) slot.covers += covers;
    orderSlot.set(order.id, key);
  }

  for (const item of items) {
    const key = orderSlot.get(item.orderId);
    if (!key) continue;
    const slot = slots.get(key);
    const figures = calculateLineFinancials(item.unitPriceSnapshot, null, item.quantity);
    if (!slot || !figures) continue;
    slot.grossRecordedItemValue += figures.grossItemValue;
    slot.itemQuantity += figures.quantity;
  }

  return Array.from(slots.values()).map((slot) => ({
    ...slot,
    grossRecordedItemValue: roundMoney(slot.grossRecordedItemValue)
  }));
}
