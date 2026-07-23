import type { AppState, Goal, Habit, ISODate, Task } from '../types';
import { addDays, datesBetween, startOfWeek, todayISO } from './date';
import { occursOnDate } from './recurrence';

export interface RateStat {
  completed: number;
  total: number;
  rate: number;
}

export const tasksForDate = (tasks: Task[], date: ISODate): Task[] => {
  const direct = tasks.filter(
    (task) => task.date === date && (task.recurrence.type === 'none' || Boolean(task.recurrenceSourceId))
  );
  const generatedIds = new Set(
    direct.filter((task) => task.recurrenceSourceId).map((task) => task.recurrenceSourceId)
  );
  const recurring = tasks.filter(
    (task) =>
      !task.recurrenceSourceId &&
      task.recurrence.type !== 'none' &&
      occursOnDate(task, date) &&
      !generatedIds.has(task.id)
  );
  return [...direct, ...recurring].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
  });
};

export const taskStatsForDate = (tasks: Task[], date: ISODate): RateStat => {
  const daily = tasksForDate(tasks, date);
  const completed = daily.filter((task) => task.completed).length;
  return { completed, total: daily.length, rate: daily.length ? Math.round((completed / daily.length) * 100) : 0 };
};

export const habitStatsForDate = (state: AppState, date: ISODate): RateStat => {
  const habits = state.habits.filter((habit) => habit.active);
  const completed = habits.filter((habit) =>
    state.habitRecords.some((record) => record.habitId === habit.id && record.date === date && record.completed)
  ).length;
  return { completed, total: habits.length, rate: habits.length ? Math.round((completed / habits.length) * 100) : 0 };
};

export const habitStreak = (state: AppState, habit: Habit, until = todayISO()): { current: number; longest: number } => {
  const completedDates = new Set(
    state.habitRecords
      .filter((record) => record.habitId === habit.id && record.completed)
      .map((record) => record.date)
  );
  let current = 0;
  let cursor = until;
  while (completedDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  const ordered = [...completedDates].sort();
  let longest = 0;
  let run = 0;
  let previous: ISODate | undefined;
  ordered.forEach((date) => {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  });
  return { current, longest };
};

export const periodTaskStats = (tasks: Task[], start: ISODate, end: ISODate): RateStat => {
  const all = datesBetween(start, end).flatMap((date) => tasksForDate(tasks, date));
  const completed = all.filter((task) => task.completed).length;
  return { completed, total: all.length, rate: all.length ? Math.round((completed / all.length) * 100) : 0 };
};

export const periodHabitStats = (state: AppState, start: ISODate, end: ISODate): RateStat => {
  const dates = datesBetween(start, end);
  const total = dates.length * state.habits.filter((habit) => habit.active).length;
  const completed = state.habitRecords.filter(
    (record) => record.completed && record.date >= start && record.date <= end
  ).length;
  return { completed, total, rate: total ? Math.round((completed / total) * 100) : 0 };
};

export const autoGoalProgress = (state: AppState, goal: Goal): number => {
  const relatedTasks = state.tasks.filter((task) => task.goalId === goal.id || goal.taskIds.includes(task.id));
  const relatedHabits = state.habits.filter((habit) => habit.goalId === goal.id || goal.habitIds.includes(habit.id));
  const taskValues = relatedTasks.map((task) => {
    if (!task.subtasks.length) return task.completed ? 100 : 0;
    return Math.round((task.subtasks.filter((item) => item.completed).length / task.subtasks.length) * 100);
  });
  const habitValues = relatedHabits.map((habit) => {
    const weekStart = startOfWeek(todayISO(), state.settings.weekStartsOn);
    const completed = state.habitRecords.filter(
      (record) => record.habitId === habit.id && record.completed && record.date >= weekStart && record.date <= todayISO()
    ).length;
    return Math.round((completed / 7) * 100);
  });
  const children = state.goals.filter((item) => item.parentGoalId === goal.id).map((item) => item.progress);
  const values = [...taskValues, ...habitValues, ...children];
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : goal.progress;
};

export const pointsTotal = (state: AppState): number =>
  state.pointLedger.reduce((total, item) => total + item.points, 0);

export const levelForPoints = (points: number): { level: number; current: number; next: number } => {
  const level = Math.floor(Math.sqrt(Math.max(0, points) / 25)) + 1;
  const base = (level - 1) ** 2 * 25;
  const nextBase = level ** 2 * 25;
  return { level, current: points - base, next: nextBase - base };
};

export const titleForLevel = (level: number): string => {
  if (level >= 10) return '澄みわたる空';
  if (level >= 7) return '積み重ねの達人';
  if (level >= 5) return '穏やかな継続者';
  if (level >= 3) return '青空の歩み手';
  return '空を見上げる人';
};
