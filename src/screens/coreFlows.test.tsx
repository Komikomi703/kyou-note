import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, createEntityBase } from '../state/AppContext';
import { createInitialState } from '../data/seed';
import { saveState } from '../data/storage';
import { HabitsScreen } from './HabitsScreen';
import { GoalsScreen } from './GoalsScreen';
import { ReflectionScreen } from './ReflectionScreen';
import { SearchScreen } from './SearchScreen';
import { SettingsScreen } from './SettingsScreen';

describe('主要画面の利用フロー', () => {
  it('習慣を追加して日別の達成を記録できる', async () => {
    const user = userEvent.setup();
    render(<AppProvider><HabitsScreen selectedDate="2026-07-23" /></AppProvider>);
    await user.click(screen.getByRole('button', { name: '習慣を追加' }));
    await user.type(screen.getByPlaceholderText('例：読書20分'), '水を飲む');
    await user.click(screen.getByRole('button', { name: '保存' }));
    const complete = screen.getByRole('button', { name: '水を飲むの2026-07-23を達成にする' });
    await user.click(complete);
    expect(complete).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '水を飲む' })).toBeInTheDocument();
  });

  it('大きな目標と小目標を作成できる', async () => {
    const user = userEvent.setup();
    render(<AppProvider><GoalsScreen /></AppProvider>);
    await user.click(screen.getByRole('button', { name: '最初の目標を追加' }));
    await user.type(screen.getByPlaceholderText('例：ITパスポートに合格する'), '資格に合格する');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(screen.getByRole('button', { name: '追加' }));
    await user.type(screen.getByPlaceholderText('例：ITパスポートに合格する'), '参考書を終える');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('heading', { name: '資格に合格する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /参考書を終える/ })).toBeInTheDocument();
  });

  it('振り返りを保存し、保存済み状態を表示する', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ReflectionScreen selectedDate="2026-07-23" onDateChange={() => undefined} />
      </AppProvider>
    );
    await user.type(screen.getByPlaceholderText('小さなことでも大丈夫です'), 'テストを完了した');
    await user.click(screen.getByRole('button', { name: '振り返りを保存' }));
    expect(screen.getByText('保存しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '変更を保存' })).toBeInTheDocument();
  });

  it('キーワードと状態でタスクを絞り込み、対象日へ移動できる', async () => {
    const state = createInitialState();
    state.tasks = [
      {
        ...createEntityBase(state.currentUser.id),
        title: 'Python演習',
        date: '2026-07-23',
        priority: 'important',
        notes: 'API問題',
        completed: false,
        recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
        reminders: [],
        subtasks: [],
        attachmentIds: [],
        pointsAwarded: false
      }
    ];
    saveState(state);
    const dates: string[] = [];
    const screens: string[] = [];
    const user = userEvent.setup();
    render(
      <AppProvider>
        <SearchScreen onDateChange={(date) => dates.push(date)} onNavigate={(value) => screens.push(value)} />
      </AppProvider>
    );
    await user.type(screen.getByLabelText('検索キーワード'), 'Python');
    await user.selectOptions(screen.getByLabelText('状態'), 'open');
    await user.click(screen.getByRole('button', { name: '検索する' }));
    await user.click(screen.getByRole('button', { name: /Python演習/ }));
    expect(dates).toEqual(['2026-07-23']);
    expect(screens).toEqual(['today']);
  });

  it('設定内メニューで画面ルートを変えずに対象項目へ移動する', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    window.history.replaceState(null, '', '#settings');
    render(<AppProvider><SettingsScreen onNavigate={() => undefined} /></AppProvider>);
    await user.click(screen.getByRole('button', { name: '通知' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(window.location.hash).toBe('#settings');
    window.history.replaceState(null, '', '#today');
  });
});
