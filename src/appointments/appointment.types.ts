export interface Appointment {
  id: string;
  customerId: string;
  date: string;
  time: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentInput {
  customerId: string;
  date: string;
  time: string;
}

export type Clock = () => Date;

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= 1 &&
    year <= 9999 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function parseDateInput(input: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (!isValidDateParts(year, month, day)) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function parseTimeInput(input: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(input);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

export function isNormalizedDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return false;
  }

  return isValidDateParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
}

export function isNormalizedTime(time: string): boolean {
  return parseTimeInput(time) === time;
}

function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function isDateTodayOrFuture(date: string, now: Date): boolean {
  return isNormalizedDate(date) && date >= formatLocalDate(now);
}

export function isFutureSlot(date: string, time: string, now: Date): boolean {
  if (!isNormalizedDate(date) || !isNormalizedTime(time)) {
    return false;
  }

  const candidate = `${date}T${time}`;
  const currentMinute = `${formatLocalDate(now)}T${formatLocalTime(now)}`;
  return candidate > currentMinute;
}

export function formatDateForDisplay(date: string): string {
  if (!isNormalizedDate(date)) {
    return date;
  }

  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
