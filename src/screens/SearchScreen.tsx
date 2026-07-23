import { useMemo, useState } from 'react';
import type { ISODate, Priority, Screen } from '../types';
import { useApp } from '../state/AppContext';
import { Icon, EmptyState } from '../components/ui';

interface SearchScreenProps {
  onNavigate: (screen: Screen) => void;
  onDateChange: (date: ISODate) => void;
}

export function SearchScreen({ onNavigate, onDateChange }: SearchScreenProps) {
  const { state } = useApp();
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [status, setStatus] = useState('');
  const [goalId, setGoalId] = useState('');
  const [habitId, setHabitId] = useState('');
  const [searched, setSearched] = useState(false);

  const query = keyword.trim().toLocaleLowerCase('ja');
  const results = useMemo(() => {
    const matchesText = (value: string) => !query || value.toLocaleLowerCase('ja').includes(query);
    const matchesDate = (date?: ISODate) => (!startDate || Boolean(date && date >= startDate)) && (!endDate || Boolean(date && date <= endDate));
    const goalHasHabit = (candidateGoalId?: string) =>
      !habitId ||
      Boolean(
        candidateGoalId &&
        (
          state.goals.find((goal) => goal.id === candidateGoalId)?.habitIds.includes(habitId) ||
          state.habits.some((habit) => habit.id === habitId && habit.goalId === candidateGoalId)
        )
      );
    const tasks = state.tasks.filter((task) =>
      matchesText(`${task.title} ${task.notes}`) &&
      matchesDate(task.date) &&
      (!categoryId || task.categoryId === categoryId) &&
      (!priority || task.priority === priority) &&
      (!status || (status === 'complete' ? task.completed : !task.completed)) &&
      (!goalId || task.goalId === goalId) &&
      goalHasHabit(task.goalId)
    );
    const goals = state.goals.filter((goal) =>
      matchesText(`${goal.title} ${goal.description}`) &&
      matchesDate(goal.startDate) &&
      (!status || (status === 'complete' ? goal.completed : !goal.completed)) &&
      (!goalId || goal.id === goalId) &&
      (!habitId || goal.habitIds.includes(habitId) || state.habits.some((habit) => habit.id === habitId && habit.goalId === goal.id)) &&
      !categoryId && !priority
    );
    const reflections = state.reflections.filter((reflection) =>
      matchesText(`${reflection.wins} ${reflection.challenges} ${reflection.tomorrow} ${reflection.notes}`) &&
      matchesDate(reflection.date) &&
      (
        !habitId ||
        state.habitRecords.some(
          (record) => record.habitId === habitId && record.date === reflection.date && record.completed
        )
      ) &&
      !categoryId && !priority && !status && !goalId
    );
    const habits = state.habits.filter((habit) =>
      matchesText(habit.name) && (!habitId || habit.id === habitId) && !categoryId && !priority && !status && !goalId
    );
    return { tasks, goals, reflections, habits };
  }, [categoryId, endDate, goalId, habitId, priority, query, startDate, state.goals, state.habitRecords, state.habits, state.reflections, state.tasks, status]);
  const count = results.tasks.length + results.goals.length + results.reflections.length + results.habits.length;

  const go = (screen: Screen, date?: ISODate) => {
    if (date) onDateChange(date);
    onNavigate(screen);
  };

  return (
    <div className="screen">
      <header className="screen-header"><div><p className="eyebrow">SEARCH</p><h1>記録を検索</h1><p>タスク・目標・習慣・振り返りをまとめて探せます。</p></div></header>
      <section className="search-panel">
        <label className="search-field search-field--large"><Icon name="search" /><input autoFocus value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && setSearched(true)} placeholder="キーワードを入力" aria-label="検索キーワード" /></label>
        <div className="filter-row filter-row--search">
          <label><span>開始日</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label><span>終了日</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <label><span>カテゴリー</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">すべて</option>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label><span>優先度</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority | '')}><option value="">すべて</option><option value="important">重要</option><option value="normal">普通</option><option value="someday">余裕があれば</option></select></label>
          <label><span>状態</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">すべて</option><option value="open">未完了</option><option value="complete">完了</option></select></label>
          <label><span>目標</span><select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">すべて</option>{state.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
          <label><span>習慣</span><select value={habitId} onChange={(event) => setHabitId(event.target.value)}><option value="">すべて</option>{state.habits.map((habit) => <option key={habit.id} value={habit.id}>{habit.name}</option>)}</select></label>
        </div>
        <div className="search-actions">
          <button className="button button--ghost" onClick={() => { setKeyword(''); setStartDate(''); setEndDate(''); setCategoryId(''); setPriority(''); setStatus(''); setGoalId(''); setHabitId(''); setSearched(false); }}>条件をクリア</button>
          <button className="button button--primary" onClick={() => setSearched(true)}><Icon name="search" /> 検索する</button>
        </div>
      </section>

      {searched && (
        <section className="search-results">
          <header><h2>検索結果</h2><span>{count}件</span></header>
          {results.tasks.map((task) => <button key={`task-${task.id}`} className="search-result" onClick={() => go('today', task.date)}><span className="search-result__type">タスク</span><div><strong>{task.title}</strong><p>{task.date} · {state.categories.find((item) => item.id === task.categoryId)?.name ?? '未分類'} · {task.completed ? '完了' : '未完了'}</p></div><Icon name="chevronRight" /></button>)}
          {results.goals.map((goal) => <button key={`goal-${goal.id}`} className="search-result" onClick={() => go('goals')}><span className="search-result__type search-result__type--goal">目標</span><div><strong>{goal.title}</strong><p>進捗 {goal.progress}% · {goal.completed ? '達成済み' : '進行中'}</p></div><Icon name="chevronRight" /></button>)}
          {results.reflections.map((reflection) => <button key={`reflection-${reflection.id}`} className="search-result" onClick={() => go('reflection', reflection.date)}><span className="search-result__type search-result__type--reflection">振り返り</span><div><strong>{reflection.date}の振り返り</strong><p>{reflection.wins || reflection.notes || '記録を見る'}</p></div><Icon name="chevronRight" /></button>)}
          {results.habits.map((habit) => <button key={`habit-${habit.id}`} className="search-result" onClick={() => go('habits')}><span className="search-result__type search-result__type--habit">習慣</span><div><strong>{habit.icon} {habit.name}</strong><p>{habit.active ? '記録中' : '休止中'}</p></div><Icon name="chevronRight" /></button>)}
          {!count && <EmptyState title="見つかりませんでした" description="キーワードや絞り込み条件を変えてみてください。" />}
        </section>
      )}
    </div>
  );
}
