import type { AppState, Habit, Task } from '../types';
import { tasksForDate } from '../lib/stats';
import { toISODate, todayISO } from '../lib/date';

const SHOWN_KEY = 'kyou-note:shown-reminders';
const readShownKeys = (): Set<string> => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(-500) : []);
  } catch {
    return new Set();
  }
};
const writeShownKeys = (keys: Set<string>): void => {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...keys].slice(-500)));
  } catch {
    // 通知履歴を保存できなくても、通知機能そのものは継続します。
  }
};

export const notificationSupport = (): 'supported' | 'unsupported' =>
  'Notification' in window ? 'supported' : 'unsupported';

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
};

const reminderTime = (task: Task, occurrenceDate: string): Date | undefined => {
  const reminder = task.reminders.find((item) => item.enabled);
  if (!reminder) return undefined;
  if (reminder.kind === 'custom' && reminder.customTime) return new Date(`${occurrenceDate}T${reminder.customTime}:00`);
  const base = reminder.kind === 'deadline' ? task.deadline : task.startTime;
  if (!base) return undefined;
  return new Date(new Date(`${occurrenceDate}T${base}:00`).getTime() - reminder.minutesBefore * 60_000);
};

export const dueReminders = (state: AppState, now = new Date()): Task[] => {
  const shown = readShownKeys();
  const windowStart = now.getTime() - 60_000;
  const occurrenceDate = toISODate(now);
  return tasksForDate(state.tasks, occurrenceDate).map((task) =>
    task.recurrence.type !== 'none' && !task.recurrenceSourceId ? { ...task, date: occurrenceDate } : task
  ).filter((task) => {
    if (task.completed || shown.has(`${task.id}:${task.date}`)) return false;
    const due = reminderTime(task, task.date);
    return Boolean(due && due.getTime() <= now.getTime() && due.getTime() >= windowStart);
  });
};

export const markRemindersShown = (tasks: Task[]): void => {
  const shown = readShownKeys();
  tasks.forEach((task) => shown.add(`${task.id}:${task.date}`));
  writeShownKeys(shown);
};

export const showTaskNotification = async (task: Task): Promise<void> => {
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = {
    body: task.startTime ? `${task.startTime}からの予定です` : 'タスクの時間です',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    tag: `task-${task.id}`
  };
  if (registration) await registration.showNotification(task.title, options);
  else if ('Notification' in window && Notification.permission === 'granted') new Notification(task.title, options);
};

export const showTestNotification = async (): Promise<void> => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    throw new Error('先に通知を許可してください。');
  }
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = {
    body: '通知は正しく設定されています。',
    icon: '/icon-192x192.png',
    tag: 'kyou-note-notification-test',
    data: { url: '/#settings' }
  };
  if (registration) await registration.showNotification('今日ノート・通知テスト', options);
  else new Notification('今日ノート・通知テスト', options);
};

export const dueHabitReminders = (state: AppState, now = new Date()): Habit[] => {
  const shown = readShownKeys();
  const date = toISODate(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return state.habits.filter((habit) =>
    habit.active &&
    habit.reminderEnabled &&
    habit.reminderTime === currentTime &&
    !shown.has(`habit:${habit.id}:${date}`) &&
    !state.habitRecords.some((record) => record.habitId === habit.id && record.date === date && record.completed)
  );
};

export const markHabitRemindersShown = (habits: Habit[]): void => {
  const shown = readShownKeys();
  habits.forEach((habit) => shown.add(`habit:${habit.id}:${todayISO()}`));
  writeShownKeys(shown);
};

export const showHabitNotification = async (habit: Habit): Promise<void> => {
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = {
    body: '今日の習慣を記録しましょう。',
    icon: '/icon-192x192.png',
    tag: `habit-${habit.id}-${todayISO()}`,
    data: { url: '/#habits' }
  };
  if (registration) await registration.showNotification(habit.name, options);
  else if ('Notification' in window && Notification.permission === 'granted') new Notification(habit.name, options);
};

export const showDailySummaryNotification = async (title: string, body: string, tag: string): Promise<void> => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = { body, icon: '/icon-192x192.png', tag, data: { url: '/#today' } };
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
};
