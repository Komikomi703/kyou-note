import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { AppProvider, useApp } from './AppContext';

const task: Task = {
  id: 'undo-task',
  userId: 'local-user',
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
  title: '元に戻せるタスク',
  date: '2026-07-23',
  priority: 'normal',
  notes: '',
  completed: false,
  recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
  reminders: [],
  subtasks: [],
  attachmentIds: [],
  pointsAwarded: false
};

function UndoProbe() {
  const { state, actions, undoNotice } = useApp();
  return (
    <div>
      <span data-testid="count">{state.tasks.length}</span>
      <span>{undoNotice?.label}</span>
      <button onClick={() => actions.upsertTask(task)}>追加</button>
      <button onClick={() => actions.deleteTask(task.id)}>削除</button>
      <button onClick={() => actions.undoLastDelete()}>元に戻す</button>
    </div>
  );
}

describe('削除の取り消し', () => {
  it('タスク削除後にデータと削除履歴を復元する', async () => {
    const user = userEvent.setup();
    render(<AppProvider><UndoProbe /></AppProvider>);

    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByText('「元に戻せるタスク」を削除しました')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
