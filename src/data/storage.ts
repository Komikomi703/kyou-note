import type { AppState } from '../types';
import { APP_VERSION, createInitialState } from './seed';

const STORAGE_KEY = 'kyou-note:data:v1';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const hasSavedState = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

const mergeState = (value: Partial<AppState>): AppState => {
  const initial = createInitialState();
  const settings = { ...initial.settings, ...value.settings };
  if (!['light', 'dark', 'system'].includes(settings.theme)) settings.theme = initial.settings.theme;
  if (![0, 1].includes(settings.weekStartsOn)) settings.weekStartsOn = initial.settings.weekStartsOn;
  return {
    ...initial,
    ...value,
    currentUser: { ...initial.currentUser, ...value.currentUser },
    settings,
    categories: Array.isArray(value.categories)
      ? value.categories
        .filter((category) => category && typeof category.id === 'string' && typeof category.name === 'string')
        .map((category) => ({ ...category, color: category.color || '#8191a4', isDefault: Boolean(category.isDefault) }))
      : initial.categories,
    habits: Array.isArray(value.habits)
      ? value.habits
        .filter((habit) => habit && typeof habit.id === 'string' && typeof habit.name === 'string')
        .map((habit) => ({ ...habit, icon: habit.icon || '習', color: habit.color || '#5c91cc', active: habit.active !== false }))
      : initial.habits,
    tasks: Array.isArray(value.tasks)
      ? value.tasks
        .filter((task) => task && typeof task.id === 'string' && typeof task.title === 'string' && ISO_DATE_PATTERN.test(task.date))
        .map((task) => ({
          ...task,
          priority: ['important', 'normal', 'someday'].includes(task.priority) ? task.priority : 'normal',
          notes: task.notes ?? '',
          completed: Boolean(task.completed),
          recurrence: task.recurrence?.type
            ? {
                ...task.recurrence,
                weekdays: Array.isArray(task.recurrence.weekdays) ? task.recurrence.weekdays : [],
                intervalDays: Number.isFinite(task.recurrence.intervalDays) ? Math.max(1, task.recurrence.intervalDays) : 1
              }
            : { type: 'none' as const, weekdays: [], intervalDays: 1 },
          reminders: Array.isArray(task.reminders) ? task.reminders : [],
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
          attachmentIds: Array.isArray(task.attachmentIds) ? task.attachmentIds : [],
          pointsAwarded: Boolean(task.pointsAwarded)
        }))
      : [],
    habitRecords: Array.isArray(value.habitRecords) ? value.habitRecords : [],
    goals: Array.isArray(value.goals)
      ? value.goals
        .filter((goal) => goal && typeof goal.id === 'string' && typeof goal.title === 'string')
        .map((goal) => ({
          ...goal,
          description: goal.description ?? '',
          taskIds: Array.isArray(goal.taskIds) ? goal.taskIds : [],
          habitIds: Array.isArray(goal.habitIds) ? goal.habitIds : [],
          attachmentIds: Array.isArray(goal.attachmentIds) ? goal.attachmentIds : [],
          progress: Number.isFinite(goal.progress) ? Math.max(0, Math.min(100, goal.progress)) : 0
        }))
      : [],
    goalMilestones: Array.isArray(value.goalMilestones) ? value.goalMilestones : [],
    dailyStatistics: Array.isArray(value.dailyStatistics) ? value.dailyStatistics : [],
    reflections: Array.isArray(value.reflections)
      ? value.reflections
        .filter((reflection) => reflection && typeof reflection.id === 'string' && ISO_DATE_PATTERN.test(reflection.date))
        .map((reflection) => ({
          ...reflection,
          wins: reflection.wins ?? '',
          challenges: reflection.challenges ?? '',
          tomorrow: reflection.tomorrow ?? '',
          notes: reflection.notes ?? '',
          attachmentIds: Array.isArray(reflection.attachmentIds) ? reflection.attachmentIds : []
        }))
      : [],
    attachments: Array.isArray(value.attachments) ? value.attachments : [],
    rewards: Array.isArray(value.rewards) ? value.rewards : [],
    pointLedger: Array.isArray(value.pointLedger) ? value.pointLedger : [],
    tombstones: Array.isArray(value.tombstones) ? value.tombstones : [],
    migrationHistory: Array.isArray(value.migrationHistory) ? value.migrationHistory : [],
    dailyGoals: value.dailyGoals ?? {},
    googleEvents: Array.isArray(value.googleEvents) ? value.googleEvents : []
  };
};

export const normalizeState = (value: Partial<AppState>): AppState => mergeState(value);

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return mergeState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return createInitialState();
  }
};

export const saveState = (state: AppState): AppState => {
  const next = { ...state, lastSavedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const exportState = (state: AppState): string =>
  JSON.stringify({ ...state, formatVersion: APP_VERSION, exportedAt: new Date().toISOString() }, null, 2);

export const importState = (raw: string): AppState => {
  let parsed: Partial<AppState>;
  try {
    parsed = JSON.parse(raw) as Partial<AppState>;
  } catch {
    throw new Error('JSONファイルを読み取れませんでした。今日ノートから書き出したファイルを選択してください。');
  }
  const acceptedImage = /^(data:image\/(?:jpeg|png|webp|gif);base64,|https:\/\/)/i;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.version !== 'number' ||
    !Array.isArray(parsed.tasks) ||
    !Array.isArray(parsed.habits) ||
    !Array.isArray(parsed.goals) ||
    !Array.isArray(parsed.reflections) ||
    !Array.isArray(parsed.attachments) ||
    parsed.tasks.length > 10_000 ||
    parsed.habits.length > 1_000 ||
    parsed.goals.length > 2_000 ||
    parsed.reflections.length > 5_000 ||
    parsed.attachments.length > 1_000 ||
    (parsed.categories !== undefined && (
      !Array.isArray(parsed.categories) ||
      parsed.categories.length > 200 ||
      !parsed.categories.every((category) =>
        category &&
        typeof category.id === 'string' &&
        typeof category.name === 'string' &&
        category.name.trim().length > 0 &&
        category.name.length <= 40 &&
        typeof category.color === 'string' &&
        category.color.length <= 32
      )
    )) ||
    !parsed.tasks.every(
      (task) =>
        task &&
        typeof task.id === 'string' &&
        typeof task.title === 'string' &&
        task.title.trim().length > 0 &&
        task.title.length <= 120 &&
        typeof task.date === 'string' &&
        ISO_DATE_PATTERN.test(task.date) &&
        ['important', 'normal', 'someday'].includes(task.priority) &&
        String(task.notes ?? '').length <= 5000 &&
        Array.isArray(task.subtasks) &&
        task.subtasks.length <= 200 &&
        task.subtasks.every((subtask) => subtask && typeof subtask.id === 'string' && typeof subtask.title === 'string' && subtask.title.length <= 120) &&
        Array.isArray(task.reminders) &&
        task.reminders.length <= 10
    ) ||
    !parsed.habits.every(
      (habit) =>
        habit &&
        typeof habit.id === 'string' &&
        typeof habit.name === 'string' &&
        habit.name.trim().length > 0 &&
        habit.name.length <= 80
    ) ||
    !parsed.goals.every(
      (goal) =>
        goal &&
        typeof goal.id === 'string' &&
        typeof goal.title === 'string' &&
        goal.title.length <= 120 &&
        String(goal.description ?? '').length <= 5000
    ) ||
    !parsed.reflections.every(
      (reflection) =>
        reflection &&
        typeof reflection.id === 'string' &&
        typeof reflection.date === 'string' &&
        ISO_DATE_PATTERN.test(reflection.date) &&
        String(reflection.wins ?? '').length <= 5000 &&
        String(reflection.challenges ?? '').length <= 5000 &&
        String(reflection.tomorrow ?? '').length <= 5000 &&
        String(reflection.notes ?? '').length <= 10000
    ) ||
    !parsed.attachments.every(
      (attachment) =>
        attachment &&
        typeof attachment.id === 'string' &&
        typeof attachment.name === 'string' &&
        attachment.name.length <= 255 &&
        ['task', 'goal', 'reflection'].includes(attachment.ownerType) &&
        typeof attachment.mimeType === 'string' &&
        ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(attachment.mimeType) &&
        typeof attachment.size === 'number' &&
        attachment.size >= 0 &&
        attachment.size <= 2 * 1024 * 1024 &&
        typeof attachment.dataUrl === 'string' &&
        attachment.dataUrl.length <= 3_000_000 &&
        acceptedImage.test(attachment.dataUrl)
    ) ||
    Boolean(parsed.settings?.displayName && parsed.settings.displayName.length > 40) ||
    Boolean(parsed.settings?.theme && !['light', 'dark', 'system'].includes(parsed.settings.theme)) ||
    Boolean(parsed.settings?.weekStartsOn !== undefined && ![0, 1].includes(parsed.settings.weekStartsOn))
  ) {
    throw new Error('今日ノートのJSON形式ではありません。');
  }
  return mergeState(parsed);
};

export const clearState = (): void => localStorage.removeItem(STORAGE_KEY);
