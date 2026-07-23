import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import { mergeAppStates } from './sync';
import type { Task } from '../types';

const task = (id: string, title: string, updatedAt: string): Task => ({
  id,
  userId: 'user',
  title,
  date: '2026-07-23',
  priority: 'normal',
  notes: '',
  completed: false,
  recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
  reminders: [],
  subtasks: [],
  attachmentIds: [],
  pointsAwarded: false,
  createdAt: updatedAt,
  updatedAt
});

describe('クラウド同期の競合解決', () => {
  it('更新日時が新しい項目を採用しIDで重複を防ぐ', () => {
    const local = createInitialState();
    const cloud = createInitialState();
    local.tasks = [task('same', 'ローカル', '2026-07-23T10:00:00.000Z')];
    cloud.tasks = [task('same', 'クラウド', '2026-07-23T11:00:00.000Z')];
    expect(mergeAppStates(local, cloud).tasks).toHaveLength(1);
    expect(mergeAppStates(local, cloud).tasks[0].title).toBe('クラウド');
  });

  it('削除履歴より古いデータを復活させない', () => {
    const local = createInitialState();
    const cloud = createInitialState();
    cloud.tasks = [task('deleted', '復活してはいけない', '2026-07-23T10:00:00.000Z')];
    local.tombstones = [{ entityType: 'task', entityId: 'deleted', deletedAt: '2026-07-23T11:00:00.000Z' }];
    expect(mergeAppStates(local, cloud).tasks).toHaveLength(0);
  });
});
