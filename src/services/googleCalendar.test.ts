import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../types';
import { createGoogleEvent } from './googleCalendar';

const task: Task = {
  id: 'task-1',
  userId: 'user',
  title: '重複しない予定',
  date: '2026-07-23',
  priority: 'normal',
  notes: '',
  completed: false,
  recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
  reminders: [],
  subtasks: [],
  attachmentIds: [],
  pointsAwarded: false,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z'
};

afterEach(() => vi.unstubAllGlobals());

describe('Googleカレンダー同期', () => {
  it('同じタスクIDの予定がある場合は新規作成しない', async () => {
    sessionStorage.setItem('kyou-note:google-calendar-token', 'session-only-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ id: 'existing-event' }] })
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(createGoogleEvent(task)).resolves.toBe('existing-event');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain('privateExtendedProperty=kyouNoteTaskId%3Dtask-1');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer session-only-token' })
    });
  });
});
