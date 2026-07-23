import { useMemo, useState } from 'react';
import type { ISODate, Screen, Task } from '../types';
import { useApp } from '../state/AppContext';
import { addMonths, formatMonth, getCalendarDays, startOfMonth, todayISO } from '../lib/date';
import { habitStatsForDate, taskStatsForDate, tasksForDate } from '../lib/stats';
import { EmptyState, Icon, ProgressBar } from '../components/ui';
import { TaskCard } from '../components/TaskCard';
import { TaskForm } from '../components/TaskForm';

export function CalendarScreen({
  selectedDate,
  onDateChange,
  onNavigate
}: {
  selectedDate: ISODate;
  onDateChange: (date: ISODate) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const { state } = useApp();
  const [month, setMonth] = useState(startOfMonth(selectedDate));
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task>();
  const days = getCalendarDays(month, state.settings.weekStartsOn);
  const weekdays = state.settings.weekStartsOn === 1
    ? ['月', '火', '水', '木', '金', '土', '日']
    : ['日', '月', '火', '水', '木', '金', '土'];
  const selectedTasks = useMemo(() => tasksForDate(state.tasks, selectedDate), [selectedDate, state.tasks]);
  const reflection = state.reflections.find((item) => item.date === selectedDate);
  const taskStats = taskStatsForDate(state.tasks, selectedDate);
  const habitStats = habitStatsForDate(state, selectedDate);

  const selectDate = (date: ISODate) => {
    onDateChange(date);
    if (date.slice(0, 7) !== month.slice(0, 7)) setMonth(startOfMonth(date));
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">CALENDAR</p><h1>カレンダー</h1><p>日々の積み重ねを、空模様のように見渡せます。</p></div>
        <button className="button button--primary" onClick={() => setTaskFormOpen(true)}><Icon name="plus" /> 予定を追加</button>
      </header>

      <div className="calendar-layout">
        <section className="calendar-card">
          <header className="calendar-header">
            <button className="icon-button" onClick={() => setMonth(addMonths(month, -1))} aria-label="前月"><Icon name="chevronLeft" /></button>
            <h2>{formatMonth(month)}</h2>
            <button className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="翌月"><Icon name="chevronRight" /></button>
            <button className="button button--ghost button--small" onClick={() => { setMonth(startOfMonth(todayISO())); onDateChange(todayISO()); }}>今月</button>
          </header>
          <div className="calendar-grid calendar-grid--header">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-grid" role="grid" aria-label={formatMonth(month)}>
            {days.map((date) => {
              const stats = taskStatsForDate(state.tasks, date);
              const isOutside = date.slice(0, 7) !== month.slice(0, 7);
              const status = stats.total === 0 ? 'none' : stats.rate === 100 ? 'complete' : stats.rate >= 50 ? 'progress' : 'low';
              return (
                <button
                  key={date}
                  className={`calendar-day status-${status} ${date === todayISO() ? 'is-today' : ''} ${date === selectedDate ? 'is-selected' : ''} ${isOutside ? 'is-outside' : ''}`}
                  onClick={() => selectDate(date)}
                  role="gridcell"
                  aria-selected={date === selectedDate}
                  aria-label={`${date}、タスク${stats.total}件、完了${stats.completed}件`}
                >
                  <span className="calendar-day__number">{Number(date.slice(-2))}</span>
                  {stats.total > 0 && (
                    <span className="calendar-day__stats">
                      <b>{stats.completed}/{stats.total}</b>
                      <i style={{ '--rate': `${stats.rate}%` } as React.CSSProperties} />
                    </span>
                  )}
                  {state.reflections.some((item) => item.date === date) && <span className="calendar-day__reflection" aria-label="振り返りあり">•</span>}
                </button>
              );
            })}
          </div>
          <footer className="calendar-legend">
            <span><i className="legend-dot legend-dot--complete" /> 100%</span>
            <span><i className="legend-dot legend-dot--progress" /> 50%以上</span>
            <span><i className="legend-dot legend-dot--low" /> 50%未満</span>
          </footer>
        </section>

        <aside className="day-detail">
          <div className="section-heading">
            <div><span className="section-kicker">SELECTED DAY</span><h2>{selectedDate}</h2></div>
            <button className="button button--text" onClick={() => onNavigate('today')}>日別画面へ</button>
          </div>
          <div className="day-detail__stats">
            <div><strong>{taskStats.rate}%</strong><span>タスク</span><ProgressBar value={taskStats.rate} /></div>
            <div><strong>{habitStats.rate}%</strong><span>習慣</span><ProgressBar value={habitStats.rate} /></div>
          </div>
          {state.dailyGoals[selectedDate] && <div className="day-goal"><span>目標</span><p>{state.dailyGoals[selectedDate]}</p></div>}
          <div className="task-list task-list--compact">
            {selectedTasks.length ? selectedTasks.map((task) => (
              <TaskCard
                compact
                key={`${task.id}:${selectedDate}`}
                task={task}
                date={selectedDate}
                onEdit={(value) => { setEditingTask(value); setTaskFormOpen(true); }}
              />
            )) : <EmptyState title="タスクなし" description="この日の予定はありません。" />}
          </div>
          <div className="day-reflection-summary">
            <h3>気分・振り返り</h3>
            {reflection ? (
              <p><span>{({ great: '😄', good: '🙂', okay: '😌', tired: '😮‍💨', bad: '😔' })[reflection.mood]}</span> {reflection.wins || reflection.notes || '記録済み'}</p>
            ) : <p className="muted">まだ記録がありません。</p>}
          </div>
        </aside>
      </div>
      <TaskForm
        open={taskFormOpen}
        initialDate={selectedDate}
        task={editingTask}
        onClose={() => { setTaskFormOpen(false); setEditingTask(undefined); }}
      />
    </div>
  );
}

