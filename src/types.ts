export type ID = string;
export type ISODate = string;

export type Priority = 'important' | 'normal' | 'someday';
export type Mood = 'great' | 'good' | 'okay' | 'tired' | 'bad';
export type RepeatType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'weekdays-custom' | 'monthly' | 'interval';
export type ThemeMode = 'light' | 'dark' | 'system';
export type WeekStart = 0 | 1;

export interface Entity {
  id: ID;
  userId: ID;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Attachment extends Entity {
  ownerType: 'task' | 'goal' | 'reflection';
  ownerId: ID;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  checksum?: string;
}

export interface Subtask {
  id: ID;
  title: string;
  completed: boolean;
}

export interface Recurrence {
  type: RepeatType;
  weekdays: number[];
  intervalDays: number;
  endDate?: ISODate;
}

export interface Reminder {
  enabled: boolean;
  kind: 'start' | 'deadline' | 'custom';
  minutesBefore: number;
  customTime?: string;
}

export interface Task extends Entity {
  title: string;
  date: ISODate;
  startTime?: string;
  deadline?: string;
  durationMinutes?: number;
  categoryId?: ID;
  priority: Priority;
  notes: string;
  completed: boolean;
  completedAt?: string;
  recurrence: Recurrence;
  recurrenceSourceId?: ID;
  reminders: Reminder[];
  subtasks: Subtask[];
  attachmentIds: ID[];
  goalId?: ID;
  googleEventId?: string;
  googleCalendarId?: string;
  pointsAwarded: boolean;
}

export interface Category extends Entity {
  name: string;
  color: string;
  isDefault: boolean;
}

export interface Habit extends Entity {
  name: string;
  icon: string;
  color: string;
  active: boolean;
  goalId?: ID;
  reminderEnabled?: boolean;
  reminderTime?: string;
}

export interface HabitRecord extends Entity {
  habitId: ID;
  date: ISODate;
  completed: boolean;
  pointsAwarded: boolean;
}

export interface Goal extends Entity {
  title: string;
  description: string;
  startDate: ISODate;
  dueDate?: ISODate;
  progress: number;
  progressMode: 'auto' | 'manual';
  taskIds: ID[];
  habitIds: ID[];
  parentGoalId?: ID;
  attachmentIds: ID[];
  completed: boolean;
  completedAt?: string;
  pointsAwarded: boolean;
}

export interface DailyReflection extends Entity {
  date: ISODate;
  mood: Mood;
  wins: string;
  challenges: string;
  tomorrow: string;
  notes: string;
  attachmentIds: ID[];
  taskRate: number;
  habitRate: number;
}

export interface Reward extends Entity {
  title: string;
  cost: number;
  redeemed: boolean;
  redeemedAt?: string;
}

export interface UserSettings {
  displayName: string;
  theme: ThemeMode;
  weekStartsOn: WeekStart;
  pointsEnabled: boolean;
  notificationsEnabled: boolean;
  eveningReminder: boolean;
  eveningReminderTime: string;
  morningReminder: boolean;
  morningReminderTime: string;
  inAppReminders: boolean;
  selectedGoogleCalendarId?: string;
}

export interface UserProfile {
  id: ID;
  email?: string;
  displayName: string;
  provider: 'local' | 'password' | 'google';
}

export interface PointLedgerItem {
  id: ID;
  sourceType: 'task' | 'habit' | 'goal' | 'streak' | 'reward';
  sourceId: ID;
  points: number;
  label: string;
  createdAt: string;
}

export interface Tombstone {
  entityType: 'task' | 'category' | 'habit' | 'habitRecord' | 'goal' | 'goalMilestone' | 'dailyStatistic' | 'reflection' | 'attachment' | 'reward';
  entityId: ID;
  deletedAt: string;
}

export interface MigrationRecord {
  id: ID;
  userId: ID;
  strategy: 'merge' | 'cloud' | 'local' | 'skip';
  migratedAt: string;
  localItemCount: number;
  cloudItemCount: number;
}

export interface DailyStatistics extends Entity {
  date: ISODate;
  taskCompleted: number;
  taskTotal: number;
  habitCompleted: number;
  habitTotal: number;
}

export interface GoalMilestone extends Entity {
  goalId: ID;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  htmlLink?: string;
}

export interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
  accessRole: string;
}

export interface AppState {
  version: number;
  currentUser: UserProfile;
  settings: UserSettings;
  tasks: Task[];
  categories: Category[];
  habits: Habit[];
  habitRecords: HabitRecord[];
  goals: Goal[];
  goalMilestones: GoalMilestone[];
  dailyStatistics: DailyStatistics[];
  reflections: DailyReflection[];
  attachments: Attachment[];
  rewards: Reward[];
  pointLedger: PointLedgerItem[];
  tombstones: Tombstone[];
  migrationHistory: MigrationRecord[];
  dailyGoals: Record<ISODate, string>;
  googleEvents: GoogleCalendarEvent[];
  lastGoogleSyncAt?: string;
  lastSavedAt?: string;
  lastSyncedAt?: string;
}

export type Screen =
  | 'today'
  | 'calendar'
  | 'tasks'
  | 'habits'
  | 'goals'
  | 'reflection'
  | 'reports'
  | 'search'
  | 'settings'
  | 'auth';
