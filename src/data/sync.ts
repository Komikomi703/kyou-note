import type { AppState, Entity, Tombstone } from '../types';

export type MergePreference = 'newest' | 'local' | 'cloud';

const tombstoneKey = (item: Tombstone) => `${item.entityType}:${item.entityId}`;

const mergeTombstones = (local: Tombstone[], cloud: Tombstone[]): Tombstone[] => {
  const values = new Map<string, Tombstone>();
  [...local, ...cloud].forEach((item) => {
    const existing = values.get(tombstoneKey(item));
    if (!existing || item.deletedAt > existing.deletedAt) values.set(tombstoneKey(item), item);
  });
  return [...values.values()];
};

const mergeEntities = <T extends Entity>(
  local: T[],
  cloud: T[],
  entityType: Tombstone['entityType'],
  tombstones: Tombstone[],
  preference: MergePreference
): T[] => {
  const values = new Map<string, T>();
  const allIds = new Set([...local.map((item) => item.id), ...cloud.map((item) => item.id)]);
  allIds.forEach((id) => {
    const localItem = local.find((item) => item.id === id);
    const cloudItem = cloud.find((item) => item.id === id);
    let selected = localItem ?? cloudItem;
    if (localItem && cloudItem) {
      selected = preference === 'local'
        ? localItem
        : preference === 'cloud'
          ? cloudItem
          : localItem.updatedAt > cloudItem.updatedAt
            ? localItem
            : cloudItem;
    }
    const deletion = tombstones.find((item) => item.entityType === entityType && item.entityId === id);
    if (selected && (!deletion || deletion.deletedAt < selected.updatedAt)) values.set(id, selected);
  });
  return [...values.values()];
};

const mergeById = <T extends { id: string; createdAt?: string }>(
  local: T[],
  cloud: T[],
  preference: MergePreference
): T[] => {
  const values = new Map<string, T>();
  [...cloud, ...local].forEach((item) => {
    const existing = values.get(item.id);
    if (!existing || preference === 'local' || (preference === 'newest' && (item.createdAt ?? '') >= (existing.createdAt ?? ''))) {
      values.set(item.id, item);
    }
  });
  if (preference === 'cloud') cloud.forEach((item) => values.set(item.id, item));
  return [...values.values()];
};

export const countUserData = (state: AppState): number =>
  state.tasks.length +
  state.habitRecords.length +
  state.goals.length +
  state.goalMilestones.length +
  state.dailyStatistics.length +
  state.reflections.length +
  state.attachments.length +
  state.rewards.length;

export const mergeAppStates = (
  local: AppState,
  cloud: AppState,
  preference: MergePreference = 'newest'
): AppState => {
  const tombstones = mergeTombstones(local.tombstones ?? [], cloud.tombstones ?? []);
  const chooseLocal = preference === 'local' ||
    (preference === 'newest' && (local.lastSavedAt ?? '') >= (cloud.lastSavedAt ?? ''));
  return {
    ...(chooseLocal ? cloud : local),
    ...(chooseLocal ? local : cloud),
    version: Math.max(local.version, cloud.version),
    currentUser: cloud.currentUser,
    settings: chooseLocal ? local.settings : cloud.settings,
    tasks: mergeEntities(local.tasks, cloud.tasks, 'task', tombstones, preference),
    categories: mergeEntities(local.categories, cloud.categories, 'category', tombstones, preference),
    habits: mergeEntities(local.habits, cloud.habits, 'habit', tombstones, preference),
    habitRecords: mergeEntities(local.habitRecords, cloud.habitRecords, 'habitRecord', tombstones, preference),
    goals: mergeEntities(local.goals, cloud.goals, 'goal', tombstones, preference),
    goalMilestones: mergeEntities(local.goalMilestones, cloud.goalMilestones, 'goalMilestone', tombstones, preference),
    dailyStatistics: mergeEntities(local.dailyStatistics, cloud.dailyStatistics, 'dailyStatistic', tombstones, preference),
    reflections: mergeEntities(local.reflections, cloud.reflections, 'reflection', tombstones, preference),
    attachments: mergeEntities(local.attachments, cloud.attachments, 'attachment', tombstones, preference),
    rewards: mergeEntities(local.rewards, cloud.rewards, 'reward', tombstones, preference),
    pointLedger: mergeById(local.pointLedger, cloud.pointLedger, preference),
    migrationHistory: mergeById(local.migrationHistory ?? [], cloud.migrationHistory ?? [], preference),
    tombstones,
    dailyGoals: chooseLocal ? { ...cloud.dailyGoals, ...local.dailyGoals } : { ...local.dailyGoals, ...cloud.dailyGoals },
    googleEvents: local.googleEvents,
    lastSavedAt: chooseLocal ? local.lastSavedAt : cloud.lastSavedAt,
    lastSyncedAt: new Date().toISOString()
  };
};

export const reassignStateUser = (state: AppState, userId: string): AppState => ({
  ...state,
  tasks: state.tasks.map((item) => ({ ...item, userId })),
  categories: state.categories.map((item) => ({ ...item, userId })),
  habits: state.habits.map((item) => ({ ...item, userId })),
  habitRecords: state.habitRecords.map((item) => ({ ...item, userId })),
  goals: state.goals.map((item) => ({ ...item, userId })),
  goalMilestones: state.goalMilestones.map((item) => ({ ...item, userId })),
  dailyStatistics: state.dailyStatistics.map((item) => ({ ...item, userId })),
  reflections: state.reflections.map((item) => ({ ...item, userId })),
  attachments: state.attachments.map((item) => ({ ...item, userId })),
  rewards: state.rewards.map((item) => ({ ...item, userId }))
});
