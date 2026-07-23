import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/seed';
import type { HabitRecord, Task } from '../types';
import { habitStreak, taskStatsForDate, tasksForDate } from './stats';

const recurringTask: Task = {
  id: 'repeat',
  userId: 'local-user',
  title: '筋トレ20分',
  date: '2026-07-20',
  priority: 'normal',
  notes: '',
  completed: false,
  recurrence: { type: 'daily', weekdays: [], intervalDays: 1 },
  reminders: [],
  subtasks: [],
  attachmentIds: [],
  pointsAwarded: false,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z'
};

describe('日別集計', () => {
  it('繰り返しの実績がある日はテンプレートを重複表示しない', () => {
    const occurrence: Task = {
      ...recurringTask,
      id: 'occurrence',
      date: '2026-07-23',
      recurrenceSourceId: 'repeat',
      recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
      completed: true
    };
    const result = tasksForDate([recurringTask, occurrence], '2026-07-23');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('occurrence');
    expect(taskStatsForDate([recurringTask, occurrence], '2026-07-23')).toEqual({ completed: 1, total: 1, rate: 100 });
  });

  it('開始日当日にも実績があればテンプレートを重複表示しない', () => {
    const occurrence: Task = {
      ...recurringTask,
      id: 'first-occurrence',
      recurrenceSourceId: recurringTask.id,
      recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
      completed: true
    };
    const result = tasksForDate([recurringTask, occurrence], recurringTask.date);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'first-occurrence', completed: true });
  });

  it('習慣の現在連続と最長連続を計算する', () => {
    const state = createInitialState();
    const habit = state.habits[0];
    const dates = ['2026-07-18', '2026-07-19', '2026-07-21', '2026-07-22', '2026-07-23'];
    state.habitRecords = dates.map((date, index): HabitRecord => ({
      id: String(index),
      userId: state.currentUser.id,
      habitId: habit.id,
      date,
      completed: true,
      pointsAwarded: true,
      createdAt: `${date}T00:00:00.000Z`,
      updatedAt: `${date}T00:00:00.000Z`
    }));
    expect(habitStreak(state, habit, '2026-07-23')).toEqual({ current: 3, longest: 3 });
  });
});
