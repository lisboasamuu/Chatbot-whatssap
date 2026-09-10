import { isNormalizedDate, isNormalizedTime } from '../appointments/appointment.types.js';
import { zonedDateTimeToUtc } from '../reminders/timezone.js';
import type { AutomationScheduleType, AutomationWeekday } from './automation.types.js';

const WEEKDAY_BY_UTC_DAY: AutomationWeekday[] = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
];

function localDateAt(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function weekdayOf(date: string): AutomationWeekday {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return WEEKDAY_BY_UTC_DAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
}

export interface ScheduleDefinition {
  scheduleType: AutomationScheduleType;
  oneTimeDate?: string | null;
  oneTimeTime?: string | null;
  weekdays?: AutomationWeekday[];
  times?: string[];
}

export function nextScheduledRun(
  schedule: ScheduleDefinition,
  timezone: string,
  after: Date,
): Date | null {
  if (schedule.scheduleType === 'ONE_TIME') {
    if (!schedule.oneTimeDate || !schedule.oneTimeTime) return null;
    const candidate = zonedDateTimeToUtc(schedule.oneTimeDate, schedule.oneTimeTime, timezone);
    return candidate > after ? candidate : null;
  }

  const weekdays = new Set(schedule.weekdays ?? []);
  const times = [...new Set(schedule.times ?? [])].sort();
  if (!weekdays.size || !times.length) return null;
  const today = localDateAt(after, timezone);

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addCalendarDays(today, offset);
    if (!weekdays.has(weekdayOf(date))) continue;
    for (const time of times) {
      const candidate = zonedDateTimeToUtc(date, time, timezone);
      if (candidate > after) return candidate;
    }
  }
  return null;
}

export function validDate(value: string): boolean {
  return isNormalizedDate(value);
}

export function validTime(value: string): boolean {
  return isNormalizedTime(value);
}
