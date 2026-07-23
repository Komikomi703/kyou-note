import type { ISODate, WeekStart } from '../types';

export const toISODate = (date: Date): ISODate => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayISO = (): ISODate => toISODate(new Date());

export const fromISODate = (value: ISODate): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (value: ISODate, days: number): ISODate => {
  const date = fromISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

export const addMonths = (value: ISODate, months: number): ISODate => {
  const date = fromISODate(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
};

export const startOfMonth = (value: ISODate): ISODate => `${value.slice(0, 7)}-01`;

export const endOfMonth = (value: ISODate): ISODate => {
  const date = fromISODate(startOfMonth(value));
  date.setMonth(date.getMonth() + 1, 0);
  return toISODate(date);
};

export const getCalendarDays = (month: ISODate, weekStartsOn: WeekStart): ISODate[] => {
  const first = fromISODate(startOfMonth(month));
  const firstOffset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(toISODate(first), -firstOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
};

export const startOfWeek = (value: ISODate, weekStartsOn: WeekStart): ISODate => {
  const date = fromISODate(value);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(value, -offset);
};

export const datesBetween = (start: ISODate, end: ISODate): ISODate[] => {
  const result: ISODate[] = [];
  let cursor = start;
  while (cursor <= end && result.length < 3700) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
};

export const formatDate = (value: ISODate, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('ja-JP', options ?? { month: 'long', day: 'numeric', weekday: 'short' }).format(
    fromISODate(value)
  );

export const formatMonth = (value: ISODate): string =>
  new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(fromISODate(value));

export const relativeDateLabel = (value: ISODate): string => {
  if (value === todayISO()) return '今日';
  if (value === addDays(todayISO(), 1)) return '明日';
  if (value === addDays(todayISO(), -1)) return '昨日';
  return formatDate(value);
};

export const dateDiffDays = (from: ISODate, to: ISODate): number =>
  Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);

