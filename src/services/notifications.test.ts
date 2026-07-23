import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/seed';
import { dueHabitReminders, dueReminders } from './notifications';

describe('通知判定の安定性', () => {
  it('タスク通知がなくても習慣通知を独立して判定する', () => {
    const state = createInitialState();
    state.habits[0] = { ...state.habits[0], reminderEnabled: true, reminderTime: '20:00' };
    const now = new Date(2026, 6, 23, 20, 0, 0);

    expect(dueReminders(state, now)).toHaveLength(0);
    expect(dueHabitReminders(state, now).map((habit) => habit.id)).toContain(state.habits[0].id);
  });

  it('壊れた一時通知履歴があっても画面を停止しない', () => {
    sessionStorage.setItem('kyou-note:shown-reminders', '{broken');
    const state = createInitialState();
    expect(() => dueReminders(state, new Date(2026, 6, 23, 12, 0, 0))).not.toThrow();
  });
});
