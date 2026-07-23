import type { ISODate, Recurrence, Task } from '../types';
import { dateDiffDays, fromISODate } from './date';

export const occursOnDate = (task: Task, date: ISODate): boolean => {
  if (date < task.date) return false;
  const rule = task.recurrence;
  if (rule.type === 'none') return task.date === date;
  if (rule.endDate && date > rule.endDate) return false;
  const day = fromISODate(date).getDay();
  const difference = dateDiffDays(task.date, date);

  switch (rule.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekly':
      return difference % 7 === 0;
    case 'weekdays-custom':
      return rule.weekdays.includes(day);
    case 'monthly':
      return fromISODate(task.date).getDate() === fromISODate(date).getDate();
    case 'interval':
      return difference % Math.max(1, rule.intervalDays) === 0;
    default:
      return false;
  }
};

export const isRecurringTemplate = (task: Task): boolean =>
  task.recurrence.type !== 'none' && !task.recurrenceSourceId;

export const recurrenceLabel = (rule: Recurrence): string => {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  switch (rule.type) {
    case 'none':
      return '繰り返しなし';
    case 'daily':
      return '毎日';
    case 'weekdays':
      return '平日のみ';
    case 'weekly':
      return '毎週';
    case 'weekdays-custom':
      return `毎週 ${rule.weekdays.map((day) => weekdays[day]).join('・')}曜`;
    case 'monthly':
      return '毎月';
    case 'interval':
      return `${rule.intervalDays}日ごと`;
  }
};

