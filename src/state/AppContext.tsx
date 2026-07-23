import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type {
  AppState,
  Attachment,
  Category,
  DailyReflection,
  Goal,
  Habit,
  ISODate,
  Reward,
  Task,
  UserSettings
} from '../types';
import { APP_VERSION } from '../data/seed';
import { importState, loadState, saveState } from '../data/storage';
import { mergeAppStates } from '../data/sync';
import { autoGoalProgress, habitStatsForDate, habitStreak, taskStatsForDate } from '../lib/stats';
import { isFirebaseConfigured } from '../services/firebaseConfig';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type CloudSyncStatus = 'local' | 'connecting' | 'pending' | 'syncing' | 'synced' | 'error';
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'local';

interface AppActions {
  upsertTask: (task: Task) => void;
  deleteTask: (id: string, undoable?: boolean) => void;
  undoLastDelete: () => void;
  toggleTask: (task: Task, date: ISODate) => void;
  setDailyGoal: (date: ISODate, value: string) => void;
  upsertCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  upsertHabit: (habit: Habit) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (habitId: string, date: ISODate) => void;
  upsertGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  upsertReflection: (reflection: DailyReflection) => void;
  deleteReflection: (id: string) => void;
  addAttachment: (attachment: Attachment) => void;
  deleteAttachment: (id: string) => void;
  upsertReward: (reward: Reward) => void;
  redeemReward: (id: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  replaceState: (state: AppState) => void;
  importData: (raw: string) => void;
  setGoogleEvents: (events: AppState['googleEvents']) => void;
  retryCloudSync: () => void;
}

interface AppContextValue {
  state: AppState;
  saveStatus: SaveStatus;
  saveError?: string;
  cloudSyncStatus: CloudSyncStatus;
  cloudSyncError?: string;
  pendingSyncCount: number;
  authStatus: AuthStatus;
  undoNotice?: { label: string; expiresAt: number };
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);
const makeId = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();
const withTombstones = (
  current: AppState,
  entities: Array<{ entityType: AppState['tombstones'][number]['entityType']; entityId: string }>
): AppState['tombstones'] => {
  const deletedAt = timestamp();
  const incoming = entities.map((entity) => ({ ...entity, deletedAt }));
  const incomingKeys = new Set(incoming.map((item) => `${item.entityType}:${item.entityId}`));
  return [
    ...current.tombstones.filter((item) => !incomingKeys.has(`${item.entityType}:${item.entityId}`)),
    ...incoming
  ];
};
const removeCloudAttachments = (current: AppState, attachmentIds: string[]) => {
  if (current.currentUser.provider === 'local' || !attachmentIds.length) return;
  void import('../services/firebase').then(({ deleteCloudAttachment }) =>
    Promise.allSettled(attachmentIds.map((id) => deleteCloudAttachment(current.currentUser.id, id)))
  );
};

const recalculateGoals = (state: AppState): AppState => {
  const provisional = { ...state };
  provisional.goals = state.goals.map((goal) => {
    if (goal.progressMode !== 'auto') return goal;
    const progress = autoGoalProgress(provisional, goal);
    const completed = progress >= 100;
    if (progress === goal.progress && completed === goal.completed) return goal;
    return {
      ...goal,
      progress,
      completed,
      completedAt: completed ? goal.completedAt ?? timestamp() : undefined,
      pointsAwarded: completed,
      updatedAt: timestamp()
    };
  });
  const pointLedger = [...provisional.pointLedger];
  provisional.goals.forEach((goal) => {
    if (
      goal.completed &&
      !pointLedger.some((item) => item.sourceType === 'goal' && item.sourceId === goal.id)
    ) {
      pointLedger.push({
        id: makeId(),
        sourceType: 'goal',
        sourceId: goal.id,
        points: 50,
        label: `目標達成: ${goal.title}`,
        createdAt: timestamp()
      });
    }
  });
  provisional.pointLedger = pointLedger;
  return provisional;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string>();
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('local');
  const [cloudSyncError, setCloudSyncError] = useState<string>();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [undoNotice, setUndoNotice] = useState<{ label: string; expiresAt: number }>();
  const initialRender = useRef(true);
  const remoteApplying = useRef(false);
  const cloudTimer = useRef<number | undefined>(undefined);
  const undoTimer = useRef<number | undefined>(undefined);
  const lastSavedAtRef = useRef<string | undefined>(state.lastSavedAt);
  const deletedTaskRef = useRef<{
    batchId: string;
    tasks: Task[];
    attachments: Attachment[];
    user: AppState['currentUser'];
  } | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;

  const finalizeDeletedTask = useCallback((batchId?: string) => {
    const snapshot = deletedTaskRef.current;
    if (!snapshot || (batchId && snapshot.batchId !== batchId)) return;
    removeCloudAttachments(
      { ...stateRef.current, currentUser: snapshot.user },
      snapshot.attachments.map((attachment) => attachment.id)
    );
    deletedTaskRef.current = undefined;
    setUndoNotice(undefined);
    window.clearTimeout(undoTimer.current);
  }, []);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const performCloudSync = useCallback(async () => {
    const current = { ...stateRef.current, lastSavedAt: lastSavedAtRef.current ?? stateRef.current.lastSavedAt };
    if (current.currentUser.provider === 'local') return;
    setCloudSyncStatus('syncing');
    setCloudSyncError(undefined);
    try {
      const { saveStateToCloud } = await import('../services/firebase');
      const lastSyncedAt = await saveStateToCloud(current);
      remoteApplying.current = true;
      setState((value) => ({ ...value, lastSyncedAt }));
      setPendingSyncCount(0);
      setCloudSyncStatus('synced');
    } catch {
      setCloudSyncStatus('error');
      setCloudSyncError('クラウドへ保存できませんでした。ローカルには保存されています。');
    }
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let active = true;
    if (!isFirebaseConfigured) {
      setAuthStatus('local');
      return () => undefined;
    }
    void import('../services/firebase').then(({ subscribeToAuth }) => {
      if (!active) return;
      unsubscribe = subscribeToAuth((profile) => {
        setAuthStatus(profile ? 'authenticated' : 'unauthenticated');
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.currentUser.provider === 'local') {
      setCloudSyncStatus('local');
      setPendingSyncCount(0);
      return;
    }
    let unsubscribe: () => void = () => undefined;
    let active = true;
    setCloudSyncStatus('connecting');
    if (!isFirebaseConfigured) {
      setCloudSyncStatus('error');
      setCloudSyncError('Firebaseが未設定です。ローカル保存を継続します。');
      return () => undefined;
    }
    void import('../services/firebase').then(({ subscribeToCloudState }) => {
      if (!active) return;
      unsubscribe = subscribeToCloudState(
        state.currentUser.id,
        (cloud) => {
          remoteApplying.current = true;
          setState((current) => mergeAppStates(current, { ...cloud, currentUser: current.currentUser }, 'newest'));
          setPendingSyncCount(0);
          setCloudSyncStatus('synced');
          setCloudSyncError(undefined);
        },
        (message) => {
          setCloudSyncStatus('error');
          setCloudSyncError(message);
        }
      );
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [state.currentUser.id, state.currentUser.provider]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.settings.theme;
    root.style.colorScheme = state.settings.theme === 'system' ? 'light dark' : state.settings.theme;
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
    const updateThemeColor = () => {
      const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && media?.matches);
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101d28' : '#66a9df');
    };
    updateThemeColor();
    media?.addEventListener?.('change', updateThemeColor);
    return () => media?.removeEventListener?.('change', updateThemeColor);
  }, [state.settings.theme]);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      try {
        const saved = saveState(state);
        lastSavedAtRef.current = saved.lastSavedAt;
        setSaveStatus('saved');
        setSaveError(undefined);
      } catch (error) {
        setSaveStatus('error');
        setSaveError(
          error instanceof DOMException && error.name === 'QuotaExceededError'
            ? '端末の保存容量が不足しています。不要な画像を削除してから再度お試しください。'
            : '端末へ保存できませんでした。空き容量とブラウザ設定を確認してください。'
        );
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state.currentUser.provider === 'local') return;
    if (remoteApplying.current) {
      remoteApplying.current = false;
      return;
    }
    setPendingSyncCount((count) => count + 1);
    setCloudSyncStatus('pending');
    window.clearTimeout(cloudTimer.current);
    cloudTimer.current = window.setTimeout(() => void performCloudSync(), 1200);
    return () => window.clearTimeout(cloudTimer.current);
  }, [performCloudSync, state]);

  const update = useCallback((recipe: (current: AppState) => AppState, autoGoals = true) => {
    setState((current) => {
      const next = recipe(current);
      return autoGoals ? recalculateGoals(next) : next;
    });
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      upsertTask: (task) =>
        update((current) => {
          const exists = current.tasks.some((item) => item.id === task.id);
          return { ...current, tasks: exists ? current.tasks.map((item) => (item.id === task.id ? task : item)) : [...current.tasks, task] };
        }),
      deleteTask: (id, undoable = true) => {
        const source = stateRef.current;
        const tasks = source.tasks.filter((task) => task.id === id || task.recurrenceSourceId === id);
        if (!tasks.length) return;
        const attachments = source.attachments.filter(
          (attachment) => attachment.ownerType === 'task' && tasks.some((task) => task.id === attachment.ownerId)
        );
        finalizeDeletedTask();
        if (undoable) {
          const batchId = makeId();
          deletedTaskRef.current = { batchId, tasks, attachments, user: source.currentUser };
          setUndoNotice({
            label: tasks.length > 1 ? `「${tasks[0].title}」と繰り返しを削除しました` : `「${tasks[0].title}」を削除しました`,
            expiresAt: Date.now() + 7000
          });
          undoTimer.current = window.setTimeout(() => finalizeDeletedTask(batchId), 7000);
        } else {
          removeCloudAttachments(source, attachments.map((attachment) => attachment.id));
        }
        update((current) => ({
          ...current,
          tasks: current.tasks.filter((task) => !tasks.some((deleted) => deleted.id === task.id)),
          attachments: current.attachments.filter((attachment) => !attachments.some((deleted) => deleted.id === attachment.id)),
          tombstones: withTombstones(current, [
            ...tasks.map((task) => ({ entityType: 'task' as const, entityId: task.id })),
            ...attachments.map((attachment) => ({ entityType: 'attachment' as const, entityId: attachment.id }))
          ])
        }));
      },
      undoLastDelete: () => {
        const snapshot = deletedTaskRef.current;
        if (!snapshot) return;
        window.clearTimeout(undoTimer.current);
        deletedTaskRef.current = undefined;
        setUndoNotice(undefined);
        const taskIds = new Set(snapshot.tasks.map((task) => task.id));
        const attachmentIds = new Set(snapshot.attachments.map((attachment) => attachment.id));
        update((current) => ({
          ...current,
          tasks: [
            ...current.tasks.filter((task) => !taskIds.has(task.id)),
            ...snapshot.tasks.map((task) => ({ ...task, updatedAt: timestamp() }))
          ],
          attachments: [
            ...current.attachments.filter((attachment) => !attachmentIds.has(attachment.id)),
            ...snapshot.attachments.map((attachment) => ({ ...attachment, updatedAt: timestamp() }))
          ],
          tombstones: current.tombstones.filter(
            (item) =>
              !(item.entityType === 'task' && taskIds.has(item.entityId)) &&
              !(item.entityType === 'attachment' && attachmentIds.has(item.entityId))
          )
        }));
      },
      toggleTask: (task, date) =>
        update((current) => {
          const isVirtualOccurrence = task.recurrence.type !== 'none' && !task.recurrenceSourceId;
          let tasks = [...current.tasks];
          let changedTask: Task;
          if (isVirtualOccurrence) {
            changedTask = {
              ...task,
              id: makeId(),
              date,
              completed: true,
              completedAt: timestamp(),
              recurrenceSourceId: task.id,
              recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
              createdAt: timestamp(),
              updatedAt: timestamp(),
              pointsAwarded: true
            };
            tasks.push(changedTask);
          } else {
            changedTask = {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? timestamp() : undefined,
              pointsAwarded: !task.completed,
              updatedAt: timestamp()
            };
            tasks = tasks.map((item) => (item.id === task.id ? changedTask : item));
          }
          const pointLedger = current.pointLedger.filter(
            (item) => !(item.sourceType === 'task' && item.sourceId === changedTask.id)
          );
          if (changedTask.completed) {
            const amount = changedTask.priority === 'important' ? 15 : changedTask.priority === 'normal' ? 10 : 5;
            pointLedger.push({
              id: makeId(),
              sourceId: changedTask.id,
              sourceType: 'task',
              points: amount,
              label: `タスク完了: ${changedTask.title}`,
              createdAt: timestamp()
            });
          }
          return { ...current, tasks, pointLedger };
        }),
      setDailyGoal: (date, value) => update((current) => ({ ...current, dailyGoals: { ...current.dailyGoals, [date]: value } }), false),
      upsertCategory: (category) =>
        update((current) => {
          const exists = current.categories.some((item) => item.id === category.id);
          return { ...current, categories: exists ? current.categories.map((item) => (item.id === category.id ? category : item)) : [...current.categories, category] };
        }, false),
      deleteCategory: (id) =>
        update((current) => ({
          ...current,
          categories: current.categories.filter((category) => category.id !== id),
          tasks: current.tasks.map((task) => (task.categoryId === id ? { ...task, categoryId: undefined, updatedAt: timestamp() } : task)),
          tombstones: withTombstones(current, [{ entityType: 'category', entityId: id }])
        }), false),
      upsertHabit: (habit) =>
        update((current) => {
          const exists = current.habits.some((item) => item.id === habit.id);
          return { ...current, habits: exists ? current.habits.map((item) => (item.id === habit.id ? habit : item)) : [...current.habits, habit] };
        }),
      deleteHabit: (id) =>
        update((current) => {
          const records = current.habitRecords.filter((record) => record.habitId === id);
          return {
            ...current,
            habits: current.habits.filter((habit) => habit.id !== id),
            habitRecords: current.habitRecords.filter((record) => record.habitId !== id),
            tombstones: withTombstones(current, [
              { entityType: 'habit', entityId: id },
              ...records.map((record) => ({ entityType: 'habitRecord' as const, entityId: record.id }))
            ])
          };
        }),
      toggleHabit: (habitId, date) =>
        update((current) => {
          const existing = current.habitRecords.find((record) => record.habitId === habitId && record.date === date);
          const completed = !existing?.completed;
          const recordId = existing?.id ?? makeId();
          const record = {
            id: recordId,
            habitId,
            date,
            completed,
            pointsAwarded: completed,
            userId: current.currentUser.id,
            createdAt: existing?.createdAt ?? timestamp(),
            updatedAt: timestamp()
          };
          const habitRecords = existing
            ? current.habitRecords.map((item) => (item.id === existing.id ? record : item))
            : [...current.habitRecords, record];
          const pointLedger = current.pointLedger.filter(
            (item) =>
              !(item.sourceType === 'habit' && item.sourceId === recordId) &&
              !(item.sourceType === 'streak' && item.sourceId === `${habitId}:${date}`)
          );
          if (completed) {
            const habit = current.habits.find((item) => item.id === habitId);
            pointLedger.push({
              id: makeId(),
              sourceType: 'habit',
              sourceId: recordId,
              points: 8,
              label: `習慣達成: ${habit?.name ?? '習慣'}`,
              createdAt: timestamp()
            });
            const nextState = { ...current, habitRecords, pointLedger };
            const streak = habit ? habitStreak(nextState, habit, date).current : 0;
            if (streak > 0 && streak % 7 === 0) {
              pointLedger.push({
                id: makeId(),
                sourceType: 'streak',
                sourceId: `${habitId}:${date}`,
                points: 12,
                label: `${streak}日連続ボーナス`,
                createdAt: timestamp()
              });
            }
          }
          return { ...current, habitRecords, pointLedger };
        }),
      upsertGoal: (goal) =>
        update((current) => {
          const before = current.goals.find((item) => item.id === goal.id);
          const exists = Boolean(before);
          const pointLedger = current.pointLedger.filter(
            (item) => !(item.sourceType === 'goal' && item.sourceId === goal.id)
          );
          if (goal.completed) {
            pointLedger.push({
              id: makeId(),
              sourceType: 'goal',
              sourceId: goal.id,
              points: 50,
              label: `目標達成: ${goal.title}`,
              createdAt: timestamp()
            });
          }
          return {
            ...current,
            goals: exists ? current.goals.map((item) => (item.id === goal.id ? goal : item)) : [...current.goals, goal],
            pointLedger
          };
        }),
      deleteGoal: (id) =>
        update((current) => {
          const goals = current.goals.filter((goal) => goal.id === id || goal.parentGoalId === id);
          const attachments = current.attachments.filter(
            (attachment) => attachment.ownerType === 'goal' && goals.some((goal) => goal.id === attachment.ownerId)
          );
          removeCloudAttachments(current, attachments.map((attachment) => attachment.id));
          return {
            ...current,
            goals: current.goals.filter((goal) => !goals.some((deleted) => deleted.id === goal.id)),
            tasks: current.tasks.map((task) => (task.goalId === id ? { ...task, goalId: undefined, updatedAt: timestamp() } : task)),
            habits: current.habits.map((habit) => (habit.goalId === id ? { ...habit, goalId: undefined, updatedAt: timestamp() } : habit)),
            attachments: current.attachments.filter((attachment) => !attachments.some((deleted) => deleted.id === attachment.id)),
            tombstones: withTombstones(current, [
              ...goals.map((goal) => ({ entityType: 'goal' as const, entityId: goal.id })),
              ...attachments.map((attachment) => ({ entityType: 'attachment' as const, entityId: attachment.id }))
            ])
          };
        }),
      upsertReflection: (reflection) =>
        update((current) => {
          const exists = current.reflections.some((item) => item.id === reflection.id);
          const taskStats = taskStatsForDate(current.tasks, reflection.date);
          const habitStats = habitStatsForDate(current, reflection.date);
          const statisticId = `daily-statistic:${reflection.date}`;
          const existingStatistic = current.dailyStatistics.find((item) => item.id === statisticId);
          const statistic = {
            id: statisticId,
            userId: current.currentUser.id,
            date: reflection.date,
            taskCompleted: taskStats.completed,
            taskTotal: taskStats.total,
            habitCompleted: habitStats.completed,
            habitTotal: habitStats.total,
            createdAt: existingStatistic?.createdAt ?? timestamp(),
            updatedAt: timestamp()
          };
          return {
            ...current,
            reflections: exists ? current.reflections.map((item) => (item.id === reflection.id ? reflection : item)) : [...current.reflections, reflection],
            dailyStatistics: existingStatistic
              ? current.dailyStatistics.map((item) => item.id === statisticId ? statistic : item)
              : [...current.dailyStatistics, statistic]
          };
        }, false),
      deleteReflection: (id) =>
        update((current) => {
          const attachments = current.attachments.filter(
            (attachment) => attachment.ownerType === 'reflection' && attachment.ownerId === id
          );
          removeCloudAttachments(current, attachments.map((attachment) => attachment.id));
          return {
            ...current,
            reflections: current.reflections.filter((reflection) => reflection.id !== id),
            attachments: current.attachments.filter((attachment) => !attachments.some((deleted) => deleted.id === attachment.id)),
            tombstones: withTombstones(current, [
              { entityType: 'reflection', entityId: id },
              ...attachments.map((attachment) => ({ entityType: 'attachment' as const, entityId: attachment.id }))
            ])
          };
        }, false),
      addAttachment: (attachment) => update((current) => ({ ...current, attachments: [...current.attachments, attachment] }), false),
      deleteAttachment: (id) =>
        update((current) => {
          removeCloudAttachments(current, [id]);
          return {
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== id),
            tasks: current.tasks.map((task) => ({ ...task, attachmentIds: task.attachmentIds.filter((item) => item !== id) })),
            reflections: current.reflections.map((reflection) => ({
              ...reflection,
              attachmentIds: reflection.attachmentIds.filter((item) => item !== id)
            })),
            goals: current.goals.map((goal) => ({
              ...goal,
              attachmentIds: goal.attachmentIds.filter((item) => item !== id)
            })),
            tombstones: withTombstones(current, [{ entityType: 'attachment', entityId: id }])
          };
        }, false),
      upsertReward: (reward) =>
        update((current) => {
          const exists = current.rewards.some((item) => item.id === reward.id);
          return { ...current, rewards: exists ? current.rewards.map((item) => (item.id === reward.id ? reward : item)) : [...current.rewards, reward] };
        }, false),
      redeemReward: (id) =>
        update((current) => {
          const reward = current.rewards.find((item) => item.id === id);
          const availablePoints = current.pointLedger.reduce((total, item) => total + item.points, 0);
          if (!reward || reward.redeemed || availablePoints < reward.cost) return current;
          return {
            ...current,
            rewards: current.rewards.map((item) =>
              item.id === id ? { ...item, redeemed: true, redeemedAt: timestamp(), updatedAt: timestamp() } : item
            ),
            pointLedger: [
              ...current.pointLedger,
              {
                id: makeId(),
                sourceType: 'reward',
                sourceId: id,
                points: -reward.cost,
                label: `ご褒美: ${reward.title}`,
                createdAt: timestamp()
              }
            ]
          };
        }, false),
      updateSettings: (settings) =>
        update((current) => ({
          ...current,
          settings: { ...current.settings, ...settings },
          currentUser: settings.displayName
            ? { ...current.currentUser, displayName: settings.displayName }
            : current.currentUser
        }), false),
      replaceState: (next) => setState({ ...next, version: APP_VERSION }),
      importData: (raw) => setState(importState(raw)),
      setGoogleEvents: (events) => update((current) => ({ ...current, googleEvents: events, lastGoogleSyncAt: timestamp() }), false),
      retryCloudSync: () => void performCloudSync()
    }),
    [finalizeDeletedTask, performCloudSync, update]
  );

  const value = useMemo(
    () => ({
      state,
      actions,
      saveStatus,
      saveError,
      cloudSyncStatus,
      cloudSyncError,
      pendingSyncCount,
      authStatus,
      undoNotice
    }),
    [actions, authStatus, cloudSyncError, cloudSyncStatus, pendingSyncCount, saveError, saveStatus, state, undoNotice]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

export const createEntityBase = (userId: string) => {
  const now = timestamp();
  return { id: makeId(), userId, createdAt: now, updatedAt: now };
};
