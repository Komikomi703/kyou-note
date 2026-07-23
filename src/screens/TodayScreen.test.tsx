import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../state/AppContext';
import { TodayScreen } from './TodayScreen';
import { TaskForm } from '../components/TaskForm';

describe('今日画面の主要操作', () => {
  it('タスクを追加して画面へ反映する', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TodayScreen selectedDate="2026-07-23" onDateChange={() => undefined} onNavigate={() => undefined} />
      </AppProvider>
    );
    await user.click(screen.getByRole('button', { name: '最初のタスクを追加' }));
    await user.type(screen.getByPlaceholderText('例：Pythonを30分'), 'レポートを書く');
    const addButtons = screen.getAllByRole('button', { name: 'タスクを追加' });
    await user.click(addButtons.at(-1)!);
    expect(screen.getAllByText('レポートを書く')).toHaveLength(2);
    expect(screen.getByText('0 / 1 件完了')).toBeInTheDocument();
  });

  it('初期習慣を日別に達成へ切り替える', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TodayScreen selectedDate="2026-07-23" onDateChange={() => undefined} onNavigate={() => undefined} />
      </AppProvider>
    );
    const habit = screen.getByRole('button', { name: /筋トレ20分/ });
    expect(habit).toHaveAttribute('aria-pressed', 'false');
    await user.click(habit);
    expect(habit).toHaveAttribute('aria-pressed', 'true');
  });

  it('タスクを編集・完了・削除できる', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TodayScreen selectedDate="2026-07-23" onDateChange={() => undefined} onNavigate={() => undefined} />
      </AppProvider>
    );
    await user.click(screen.getByRole('button', { name: '最初のタスクを追加' }));
    await user.type(screen.getByPlaceholderText('例：Pythonを30分'), '編集前タスク');
    await user.click(screen.getAllByRole('button', { name: 'タスクを追加' }).at(-1)!);

    await user.click(screen.getByRole('button', { name: '編集前タスクを編集' }));
    const title = screen.getByPlaceholderText('例：Pythonを30分');
    await user.clear(title);
    await user.type(title, '編集後タスク');
    await user.click(screen.getByRole('button', { name: '変更を保存' }));

    await user.click(screen.getByRole('button', { name: '編集後タスクを完了にする' }));
    expect(screen.getByText('1 / 1 件完了')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '編集後タスクを削除' }));
    expect(screen.getByText(/「編集後タスク」を削除します/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(screen.getByText('予定はまだありません')).toBeInTheDocument();
  });

  it('未保存のタスク入力を閉じる前に確認する', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TaskForm open initialDate="2026-07-23" onClose={() => undefined} />
      </AppProvider>
    );
    await user.type(screen.getByPlaceholderText('例：Pythonを30分'), '下書き');
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.getByRole('heading', { name: '入力内容を破棄しますか？' })).toBeInTheDocument();
    expect(screen.getByText(/タスク「下書き」の未保存の変更/)).toBeInTheDocument();
  });
});
