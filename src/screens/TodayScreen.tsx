import { useEffect, useMemo, useState } from 'react';
import type { ISODate, Screen, Task } from '../types';
import { useApp } from '../state/AppContext';
import { formatDate, todayISO } from '../lib/date';
import { habitStatsForDate, taskStatsForDate, tasksForDate } from '../lib/stats';
import { DateNavigator, EmptyState, Icon, ProgressBar } from '../components/ui';
import { TaskCard } from '../components/TaskCard';
import { TaskForm } from '../components/TaskForm';

export function TodayScreen({
  selectedDate,
  onDateChange,
  onNavigate
}: {
  selectedDate: ISODate;
  onDateChange: (date: ISODate) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const { state, actions } = useApp();
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task>();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const tasks = useMemo(() => tasksForDate(state.tasks, selectedDate), [selectedDate, state.tasks]);
  const taskStats = taskStatsForDate(state.tasks, selectedDate);
  const habitStats = habitStatsForDate(state, selectedDate);
  const reflection = state.reflections.find((item) => item.date === selectedDate);
  const isToday = selectedDate === todayISO();
  const completedHabits = new Set(
    state.habitRecords.filter((record) => record.date === selectedDate && record.completed).map((record) => record.habitId)
  );
  const dayGoogleEvents = state.googleEvents.filter((event) => event.start.slice(0, 10) === selectedDate);
  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const priorityOrder = { important: 0, normal: 1, someday: 2 };
  const nextTask = [...openTasks].sort(
    (a, b) =>
      (a.startTime ? 0 : 1) - (b.startTime ? 0 : 1) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      priorityOrder[a.priority] - priorityOrder[b.priority]
  )[0];

  useEffect(() => {
    setEditingGoal(false);
    setGoalDraft(state.dailyGoals[selectedDate] ?? '');
  }, [selectedDate, state.dailyGoals]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'おはようございます';
    if (hour < 18) return 'こんにちは';
    return 'おつかれさまです';
  })();

  return (
    <div className="screen today-screen">
      <header className="screen-header today-hero">
        <div>
          <p className="eyebrow">{formatDate(selectedDate, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
          <h1>{isToday ? `${greeting}、${state.settings.displayName}さん` : `${formatDate(selectedDate)}のノート`}</h1>
          <p>{isToday ? '焦らず、今日できることをひとつずつ。' : 'この日の記録を確認・編集できます。'}</p>
        </div>
        <DateNavigator date={selectedDate} onChange={onDateChange} />
      </header>

      <section className="summary-grid" aria-label="今日の進捗">
        <article className="summary-card summary-card--accent">
          <span className="summary-card__label">タスク達成率</span>
          <strong>{taskStats.rate}<small>%</small></strong>
          <ProgressBar value={taskStats.rate} />
          <p>{taskStats.completed} / {taskStats.total} 件完了</p>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">習慣達成率</span>
          <strong>{habitStats.rate}<small>%</small></strong>
          <ProgressBar value={habitStats.rate} />
          <p>{habitStats.completed} / {habitStats.total} 個達成</p>
        </article>
        <article className="summary-card summary-card--next">
          <span className="summary-card__label">次に行うタスク</span>
          {nextTask ? (
            <>
              <strong className="summary-card__task">{nextTask.title}</strong>
              <p>{nextTask.startTime ? `${nextTask.startTime} 開始` : nextTask.deadline ? `${nextTask.deadline}まで` : priorityOrder[nextTask.priority] === 0 ? '重要なタスク' : '時間指定なし'}</p>
            </>
          ) : (
            <>
              <strong className="summary-card__task">{tasks.length ? 'すべて完了しました' : 'まだありません'}</strong>
              <p>{tasks.length ? 'おつかれさまでした。' : '最初のタスクを追加しましょう。'}</p>
            </>
          )}
          <span className="cloud-decoration" aria-hidden="true"><Icon name="cloud" /></span>
        </article>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="card-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">FOCUS</span>
                <h2>今日の目標</h2>
              </div>
              {!editingGoal && (
                <button className="button button--text" onClick={() => { setGoalDraft(state.dailyGoals[selectedDate] ?? ''); setEditingGoal(true); }}>
                  <Icon name="edit" /> 編集
                </button>
              )}
            </div>
            {editingGoal ? (
              <div className="inline-form">
                <input
                  autoFocus
                  value={goalDraft}
                  maxLength={160}
                  placeholder="今日いちばん大切にしたいこと"
                  onChange={(event) => setGoalDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      actions.setDailyGoal(selectedDate, goalDraft.trim());
                      setEditingGoal(false);
                    }
                    if (event.key === 'Escape') setEditingGoal(false);
                  }}
                />
                <button className="button button--ghost" onClick={() => setEditingGoal(false)}>キャンセル</button>
                <button className="button button--primary" onClick={() => { actions.setDailyGoal(selectedDate, goalDraft.trim()); setEditingGoal(false); }}>保存</button>
              </div>
            ) : (
              <button className="daily-goal" onClick={() => { setGoalDraft(state.dailyGoals[selectedDate] ?? ''); setEditingGoal(true); }}>
                <span aria-hidden="true"><Icon name="sparkles" /></span>
                {state.dailyGoals[selectedDate] || 'まだ設定されていません。今日の目標を決めましょう。'}
              </button>
            )}
          </section>

          <section className="card-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">TASKS</span>
                <h2>{isToday ? '今日のタスク' : `${formatDate(selectedDate)}のタスク`}</h2>
              </div>
              <button
                className="button button--primary"
                onClick={() => {
                  setEditingTask(undefined);
                  setTaskFormOpen(true);
                }}
              >
                <Icon name="plus" /> タスクを追加
              </button>
            </div>
            <div className="task-list">
              {tasks.length ? (
                <>
                  {openTasks.map((task) => (
                  <TaskCard
                    key={`${task.id}:${selectedDate}`}
                    task={task}
                    date={selectedDate}
                    onEdit={(value) => {
                      setEditingTask(value);
                      setTaskFormOpen(true);
                    }}
                  />
                  ))}
                  {completedTasks.length > 0 && (
                    <details className="completed-tasks" open={!openTasks.length}>
                      <summary>完了済み <span>{completedTasks.length}件</span></summary>
                      <div className="task-list">
                        {completedTasks.map((task) => (
                          <TaskCard
                            key={`${task.id}:${selectedDate}:completed`}
                            task={task}
                            date={selectedDate}
                            onEdit={(value) => {
                              setEditingTask(value);
                              setTaskFormOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <EmptyState
                  title="予定はまだありません"
                  description="先の予定も、この日付に登録しておけます。"
                  action={
                    <button className="button button--primary" onClick={() => setTaskFormOpen(true)}>
                      最初のタスクを追加
                    </button>
                  }
                />
              )}
            </div>
          </section>

          {dayGoogleEvents.length > 0 && (
            <section className="card-section">
              <div className="section-heading">
                <div><span className="section-kicker">GOOGLE CALENDAR</span><h2>カレンダーの予定</h2></div>
              </div>
              <div className="event-list">
                {dayGoogleEvents.map((event) => (
                  <article key={event.id} className="event-item">
                    <time>{event.start.includes('T') ? event.start.slice(11, 16) : '終日'}</time>
                    <strong>{event.title}</strong>
                    {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer">開く</a>}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="dashboard-side">
          <section className="card-section">
            <div className="section-heading section-heading--compact">
              <div><span className="section-kicker">HABITS</span><h2>習慣</h2></div>
              <button className="button button--text" onClick={() => onNavigate('habits')}>詳しく見る</button>
            </div>
            <div className="mini-habits">
              {state.habits.filter((habit) => habit.active).map((habit) => {
                const done = completedHabits.has(habit.id);
                return (
                  <button
                    key={habit.id}
                    className={`mini-habit ${done ? 'is-complete' : ''}`}
                    onClick={() => actions.toggleHabit(habit.id, selectedDate)}
                    aria-pressed={done}
                  >
                    <span className="mini-habit__icon" style={{ background: `${habit.color}1f`, color: habit.color }}>{habit.icon}</span>
                    <span>{habit.name}</span>
                    <span className="mini-habit__check">{done && <Icon name="check" />}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card-section reflection-teaser">
            <div className="section-heading section-heading--compact">
              <div><span className="section-kicker">REFLECTION</span><h2>振り返り</h2></div>
            </div>
            {reflection ? (
              <>
                <span className="mood-large">{({ great: '😄', good: '🙂', okay: '😌', tired: '😮‍💨', bad: '😔' })[reflection.mood]}</span>
                <p>{reflection.wins || reflection.notes || '記録があります'}</p>
                <button className="button button--ghost button--full" onClick={() => onNavigate('reflection')}>記録を編集</button>
              </>
            ) : (
              <>
                <span className="mood-large" aria-hidden="true">🌤️</span>
                <p>今日の気分や、できたことを残しておきませんか？</p>
                <button className="button button--ghost button--full" onClick={() => onNavigate('reflection')}>振り返りを書く</button>
              </>
            )}
          </section>
        </aside>
      </div>

      <TaskForm
        open={taskFormOpen}
        initialDate={selectedDate}
        task={editingTask}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(undefined);
        }}
      />
    </div>
  );
}
