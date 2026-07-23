import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import { exportState, importState, loadState, saveState } from './storage';

describe('ローカル保存とバックアップ', () => {
  it('再読み込み後もデータを復元する', () => {
    const state = createInitialState();
    state.dailyGoals['2026-07-23'] = 'テストを終える';
    saveState(state);
    expect(loadState().dailyGoals['2026-07-23']).toBe('テストを終える');
  });

  it('JSONを書き出して再読み込みできる', () => {
    const state = createInitialState();
    const restored = importState(exportState(state));
    expect(restored.categories).toHaveLength(8);
    expect(restored.habits).toHaveLength(3);
  });

  it('異なるJSON形式を拒否する', () => {
    expect(() => importState('{"hello":"world"}')).toThrow('今日ノートのJSON形式ではありません');
  });

  it('安全でない添付形式を含むバックアップを拒否する', () => {
    const state = createInitialState();
    state.attachments.push({
      id: 'unsafe',
      userId: state.currentUser.id,
      ownerType: 'task',
      ownerId: 'task',
      name: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      size: 100,
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    expect(() => importState(exportState(state))).toThrow('今日ノートのJSON形式ではありません');
  });

  it('旧形式で省略されたタスク項目を安全な初期値で補う', () => {
    const state = createInitialState();
    localStorage.setItem('kyou-note:data:v1', JSON.stringify({
      ...state,
      tasks: [{
        id: 'old-task',
        userId: state.currentUser.id,
        title: '以前のタスク',
        date: '2026-07-23',
        priority: 'normal',
        createdAt: '2026-07-23T00:00:00.000Z',
        updatedAt: '2026-07-23T00:00:00.000Z'
      }]
    }));
    expect(loadState().tasks[0]).toMatchObject({
      notes: '',
      completed: false,
      reminders: [],
      subtasks: [],
      attachmentIds: []
    });
  });

  it('不正な優先度を持つバックアップを拒否する', () => {
    const raw = JSON.parse(exportState(createInitialState())) as Record<string, unknown>;
    raw.tasks = [{
      id: 'unsafe',
      userId: 'local-user',
      title: '不正タスク',
      date: '2026-07-23',
      priority: 'administrator',
      notes: '',
      subtasks: [],
      reminders: []
    }];
    expect(() => importState(JSON.stringify(raw))).toThrow('今日ノートのJSON形式ではありません');
  });
});
