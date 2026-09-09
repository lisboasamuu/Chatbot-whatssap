import { isNormalizedDate, isNormalizedTime } from '../appointments/appointment.types.js';

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function partsAt(instant: Date, timezone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function sameParts(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timezone: string,
): Date {
  if (!isNormalizedDate(date) || !isNormalizedTime(time)) {
    throw new Error('Invalid appointment date or time.');
  }

  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const desired: DateTimeParts = { year, month, day, hour, minute };
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desiredAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = partsAt(new Date(candidate), timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    const correction = desiredAsUtc - actualAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  const result = new Date(candidate);
  if (!sameParts(partsAt(result, timezone), desired)) {
    throw new Error('Appointment local time does not exist in the company timezone.');
  }
  return result;
}
