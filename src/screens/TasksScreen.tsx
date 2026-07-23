import { useEffect, useMemo, useState } from 'react';
import type { ISODate, Priority, Task } from '../types';
import { useApp } from '../state/AppContext';
import { formatDate, todayISO } from '../lib/date';
import { TaskCard } from '../components/TaskCard';
import { TaskForm } from '../components/TaskForm';
import { EmptyState, Icon } from '../components/ui';

type StatusFilter = 'all' | 'open' | 'complete';

export function TasksScreen({ selectedDate }: { selectedDate: ISODate }) {
  const { state } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task>();
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [range, setRange] = useState<'all' | 'today' | 'future' | 'past'>('all');
  const [visibleLimit, setVisibleLimit] = useState(100);
  const hasFilters = Boolean(keyword || categoryId || priority || status !== 'all' || range !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setCategoryId('');
    setPriority('');
    setStatus('all');
    setRange('all');
  };

  const tasks = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('ja');
    return state.tasks
      .filter((task) => !task.recurrenceSourceId)
      .filter((task) => !query || `${task.title} ${task.notes}`.toLocaleLowerCase('ja').includes(query))
      .filter((task) => !categoryId || task.categoryId === categoryId)
      .filter((task) => !priority || task.priority === priority)
      .filter((task) => status === 'all' || (status === 'complete' ? task.completed : !task.completed))
      .filter((task) => {
        if (range === 'today') return task.date === todayISO();
        if (range === 'future') return task.date > todayISO();
        if (range === 'past') return task.date < todayISO();
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }, [categoryId, keyword, priority, range, state.tasks, status]);
  useEffect(() => setVisibleLimit(100), [categoryId, keyword, priority, range, status]);
  const visibleTasks = tasks.slice(0, visibleLimit);

  const grouped = visibleTasks.reduce<Record<ISODate, Task[]>>((result, task) => {
    (result[task.date] ??= []).push(task);
    return result;
  }, {});

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">ALL TASKS</p><h1>タスク一覧</h1><p>過去から未来まで、やることをまとめて整理します。</p></div>
        <button className="button button--primary" onClick={() => setFormOpen(true)}><Icon name="plus" /> タスクを追加</button>
      </header>

      <section className="filter-card">
        <label className="search-field">
          <Icon name="search" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="タスク名・メモを検索" aria-label="タスクを検索" />
        </label>
        <div className="filter-row">
          <label><span>期間</span><select value={range} onChange={(event) => setRange(event.target.value as typeof range)}>
            <option value="all">すべて</option><option value="today">今日</option><option value="future">今後</option><option value="past">過去</option>
          </select></label>
          <label><span>カテゴリー</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">すべて</option>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label>
          <label><span>優先度</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority | '')}>
            <option value="">すべて</option><option value="important">重要</option><option value="normal">普通</option><option value="someday">余裕があれば</option>
          </select></label>
          <label><span>状態</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="all">すべて</option><option value="open">未完了</option><option value="complete">完了</option>
          </select></label>
        </div>
        <div className="filter-summary" role="status">
          <span>{tasks.length > visibleTasks.length ? `${tasks.length}件中 ${visibleTasks.length}件を表示` : `${tasks.length}件を表示`}</span>
          {hasFilters && <button className="button button--text button--small" onClick={clearFilters}>すべての条件を解除</button>}
        </div>
      </section>

      <div className="task-groups">
        {Object.entries(grouped).map(([date, dateTasks]) => (
          <section key={date} className="task-group">
            <header><h2>{formatDate(date)}</h2><span>{dateTasks?.length ?? 0}件</span></header>
            <div className="task-list">
              {dateTasks?.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  date={task.date}
                  onEdit={(value) => { setEditingTask(value); setFormOpen(true); }}
                />
              ))}
            </div>
          </section>
        ))}
        {!tasks.length && <EmptyState title="条件に合うタスクがありません" description="条件を変えるか、新しいタスクを追加してください。" action={hasFilters ? <button className="button button--ghost" onClick={clearFilters}>条件を解除</button> : undefined} />}
        {visibleTasks.length < tasks.length && (
          <button className="button button--ghost load-more" onClick={() => setVisibleLimit((value) => value + 100)}>
            さらに表示（残り{tasks.length - visibleTasks.length}件）
          </button>
        )}
      </div>
      <TaskForm
        open={formOpen}
        initialDate={selectedDate}
        task={editingTask}
        onClose={() => { setFormOpen(false); setEditingTask(undefined); }}
      />
    </div>
  );
}
