import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { occursOnDate, recurrenceLabel } from './recurrence';

const task = (type: Task['recurrence']['type'], weekdays: number[] = []): Task => ({
  id: 'task-1',
  userId: 'user',
  title: 'Pythonを30分',
  date: '2026-07-20',
  priority: 'normal',
  notes: '',
  completed: false,
  recurrence: { type, weekdays, intervalDays: 3 },
  reminders: [],
  subtasks: [],
  attachmentIds: [],
  pointsAwarded: false,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z'
});

describe('繰り返しタスク', () => {
  it('毎日は開始日以降に発生する', () => {
    const value = task('daily');
    expect(occursOnDate(value, '2026-07-19')).toBe(false);
    expect(occursOnDate(value, '2026-07-20')).toBe(true);
    expect(occursOnDate(value, '2026-08-10')).toBe(true);
  });

  it('曜日指定は選択された曜日だけ発生する', () => {
    const value = task('weekdays-custom', [1, 3, 5]);
    expect(occursOnDate(value, '2026-07-22')).toBe(true);
    expect(occursOnDate(value, '2026-07-23')).toBe(false);
    expect(recurrenceLabel(value.recurrence)).toContain('月・水・金');
  });

  it('指定日数ごとと終了日を守る', () => {
    const value = task('interval');
    value.recurrence.endDate = '2026-07-29';
    expect(occursOnDate(value, '2026-07-23')).toBe(true);
    expect(occursOnDate(value, '2026-07-24')).toBe(false);
    expect(occursOnDate(value, '2026-08-01')).toBe(false);
  });
});

