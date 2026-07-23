import type { AppState, Category, Habit } from '../types';
import { todayISO } from '../lib/date';

export const APP_VERSION = 2;
export const LOCAL_USER_ID = 'local-user';

const now = () => new Date().toISOString();

const category = (id: string, name: string, color: string): Category => ({
  id,
  userId: LOCAL_USER_ID,
  name,
  color,
  isDefault: true,
  createdAt: now(),
  updatedAt: now()
});

const habit = (id: string, name: string, icon: string, color: string): Habit => ({
  id,
  userId: LOCAL_USER_ID,
  name,
  icon,
  color,
  active: true,
  createdAt: now(),
  updatedAt: now()
});

export const createInitialState = (): AppState => ({
  version: APP_VERSION,
  currentUser: { id: LOCAL_USER_ID, displayName: 'あなた', provider: 'local' },
  settings: {
    displayName: 'あなた',
    theme: 'system',
    weekStartsOn: 1,
    pointsEnabled: true,
    notificationsEnabled: false,
    eveningReminder: true,
    eveningReminderTime: '21:00',
    morningReminder: false,
    morningReminderTime: '07:30',
    inAppReminders: true
  },
  categories: [
    category('cat-university', '大学', '#5c91cc'),
    category('cat-study', '勉強', '#6b83d6'),
    category('cat-dev', '開発', '#4e9ab0'),
    category('cat-cert', '資格', '#826fc1'),
    category('cat-work', 'バイト', '#d08a65'),
    category('cat-health', '健康', '#5fa67a'),
    category('cat-private', 'プライベート', '#c278a2'),
    category('cat-other', 'その他', '#8191a4')
  ],
  habits: [
    habit('habit-workout', '筋トレ20分', '運', '#5fa67a'),
    habit('habit-python', 'Python学習', 'Py', '#5c91cc'),
    habit('habit-it-passport', 'ITパスポートの勉強', 'IT', '#826fc1')
  ],
  tasks: [],
  habitRecords: [],
  goals: [],
  goalMilestones: [],
  dailyStatistics: [],
  reflections: [],
  attachments: [],
  rewards: [],
  pointLedger: [],
  tombstones: [],
  migrationHistory: [],
  dailyGoals: { [todayISO()]: '' },
  googleEvents: []
});
