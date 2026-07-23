import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { addDays, addMonths, datesBetween, endOfMonth, formatDate, startOfMonth, startOfWeek, todayISO } from '../lib/date';
import { habitStreak, habitStatsForDate, periodHabitStats, periodTaskStats, taskStatsForDate } from '../lib/stats';
import { EmptyState, ProgressBar } from '../components/ui';

type Period = 'week' | 'month';

export function ReportsScreen() {
  const { state } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const end = todayISO();
  const start = period === 'week' ? startOfWeek(todayISO(), state.settings.weekStartsOn) : startOfMonth(todayISO());
  const previousStart = period === 'week' ? addDays(start, -7) : addMonths(start, -1);
  const previousMonthSameDay = `${previousStart.slice(0, 7)}-${end.slice(-2)}`;
  const previousEnd = period === 'week'
    ? addDays(end, -7)
    : previousMonthSameDay > endOfMonth(previousStart)
      ? endOfMonth(previousStart)
      : previousMonthSameDay;
  const taskStats = periodTaskStats(state.tasks, start, end);
  const previousTaskStats = periodTaskStats(state.tasks, previousStart, previousEnd);
  const habitStats = periodHabitStats(state, start, end);
  const previousHabitStats = periodHabitStats(state, previousStart, previousEnd);
  const days = datesBetween(start, end);

  const categoryStats = useMemo(() => state.categories.map((category) => {
    const tasks = state.tasks.filter((task) => task.categoryId === category.id && task.date >= start && task.date <= end);
    return { ...category, total: tasks.length, completed: tasks.filter((task) => task.completed).length };
  }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total), [end, start, state.categories, state.tasks]);

  const habitRanking = useMemo(() => state.habits.map((habit) => {
    const completed = state.habitRecords.filter((record) => record.habitId === habit.id && record.completed && record.date >= start && record.date <= end).length;
    return { habit, completed, streak: habitStreak(state, habit).current };
  }).sort((a, b) => b.completed - a.completed), [end, start, state]);

  const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, tired: 2, bad: 1 };
  const moodEmoji: Record<string, string> = { great: '😄', good: '🙂', okay: '😌', tired: '😮‍💨', bad: '😔' };
  const moodRecords = days.map((date) => state.reflections.find((item) => item.date === date));
  const topCategory = categoryStats[0];
  const topHabit = habitRanking[0];
  const taskDiff = taskStats.rate - previousTaskStats.rate;
  const habitDiff = habitStats.rate - previousHabitStats.rate;

  const summary = [
    topHabit?.completed ? `${period === 'week' ? '今週' : '今月'}は「${topHabit.habit.name}」を${topHabit.completed}日続けられました。` : '習慣を1つ達成すると、ここに続けた記録が表示されます。',
    topCategory ? `最も取り組んだカテゴリーは「${topCategory.name}」で、${topCategory.completed}件完了しました。` : 'カテゴリー付きタスクを完了すると、活動の傾向が見えてきます。',
    taskDiff > 0 ? `タスク達成率は前の期間より${taskDiff}ポイント伸びています。` : taskDiff < 0 ? `前の期間より${Math.abs(taskDiff)}ポイント低めです。予定を少し軽くしても大丈夫です。` : 'タスク達成率は前の期間と同じペースです。'
  ];

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">INSIGHTS</p><h1>レポート</h1><p>結果を評価するより、続け方のヒントを見つける画面です。</p></div>
        <div className="segmented-control" aria-label="集計期間">
          <button className={period === 'week' ? 'is-selected' : ''} onClick={() => setPeriod('week')}>週間</button>
          <button className={period === 'month' ? 'is-selected' : ''} onClick={() => setPeriod('month')}>月間</button>
        </div>
      </header>

      <section className="report-summary">
        <div className="report-summary__icon">🌤️</div>
        <div><span>{formatDate(start)}〜{formatDate(end)}</span><h2>{summary[0]}</h2><p>{summary[1]} {summary[2]}</p></div>
      </section>

      <section className="report-kpis">
        <article><span>タスク完了</span><strong>{taskStats.completed}<small>件</small></strong><p className={taskDiff >= 0 ? 'trend-up' : 'trend-down'}>{taskDiff >= 0 ? '↑' : '↓'} 前期比 {Math.abs(taskDiff)}pt</p></article>
        <article><span>タスク達成率</span><strong>{taskStats.rate}<small>%</small></strong><ProgressBar value={taskStats.rate} /></article>
        <article><span>習慣達成率</span><strong>{habitStats.rate}<small>%</small></strong><p className={habitDiff >= 0 ? 'trend-up' : 'trend-down'}>{habitDiff >= 0 ? '↑' : '↓'} 前期比 {Math.abs(habitDiff)}pt</p></article>
        <article><span>最長の現在連続</span><strong>{Math.max(0, ...habitRanking.map((item) => item.streak))}<small>日</small></strong><p>{topHabit?.habit.name ?? '記録なし'}</p></article>
      </section>

      <div className="report-grid">
        <section className="card-section chart-card">
          <div className="section-heading"><div><span className="section-kicker">DAILY ACTIVITY</span><h2>日ごとの達成率</h2></div></div>
          <div className={`bar-chart ${period === 'month' ? 'bar-chart--month' : ''}`} aria-label="日ごとのタスク達成率グラフ">
            {days.map((date) => {
              const task = taskStatsForDate(state.tasks, date);
              const habit = habitStatsForDate(state, date);
              return (
                <div key={date} className="bar-chart__item" title={`${date}: タスク${task.rate}%、習慣${habit.rate}%`}>
                  <div className="bar-chart__bars">
                    <i className="bar-chart__task" style={{ height: `${Math.max(3, task.rate)}%` }} />
                    <i className="bar-chart__habit" style={{ height: `${Math.max(3, habit.rate)}%` }} />
                  </div>
                  <span>{period === 'week' ? new Intl.DateTimeFormat('ja', { weekday: 'short' }).format(new Date(`${date}T00:00`)) : Number(date.slice(-2)) % 5 === 0 ? Number(date.slice(-2)) : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="chart-legend"><span><i className="legend-task" />タスク</span><span><i className="legend-habit" />習慣</span></div>
        </section>

        <section className="card-section">
          <div className="section-heading"><div><span className="section-kicker">CATEGORIES</span><h2>カテゴリー別の活動</h2></div></div>
          {categoryStats.map((category) => (
            <div className="ranking-row" key={category.id}>
              <span className="ranking-row__dot" style={{ background: category.color }} />
              <strong>{category.name}</strong><ProgressBar value={Math.round((category.completed / category.total) * 100)} /><span>{category.completed}/{category.total}</span>
            </div>
          ))}
          {!categoryStats.length && <EmptyState title="活動データがありません" description="カテゴリー付きタスクを登録すると集計されます。" />}
        </section>

        <section className="card-section">
          <div className="section-heading"><div><span className="section-kicker">HABIT STREAKS</span><h2>続いた習慣</h2></div></div>
          {habitRanking.map(({ habit, completed, streak }, index) => (
            <div className="habit-ranking" key={habit.id}><span>{index + 1}</span><i style={{ background: `${habit.color}1f` }}>{habit.icon}</i><div><strong>{habit.name}</strong><small>現在 {streak}日連続</small></div><b>{completed}日</b></div>
          ))}
        </section>

        <section className="card-section">
          <div className="section-heading"><div><span className="section-kicker">MOOD</span><h2>気分の変化</h2></div></div>
          <div className="mood-chart">
            {moodRecords.map((reflection, index) => (
              <div key={days[index]}><span style={{ transform: `translateY(${reflection ? (5 - moodValues[reflection.mood]) * 11 : 48}px)` }}>{reflection ? moodEmoji[reflection.mood] : '·'}</span><small>{period === 'week' ? Number(days[index].slice(-2)) : index % 5 === 0 ? Number(days[index].slice(-2)) : ''}</small></div>
            ))}
          </div>
        </section>
      </div>

      <section className="card-section">
        <div className="section-heading"><div><span className="section-kicker">GOAL PROGRESS</span><h2>目標の進捗</h2></div></div>
        <div className="goal-report-list">
          {state.goals.filter((goal) => !goal.parentGoalId).map((goal) => <div key={goal.id}><span>{goal.title}</span><ProgressBar value={goal.progress} /><strong>{goal.progress}%</strong></div>)}
          {!state.goals.length && <EmptyState title="目標がありません" description="目標を作ると進捗がここに表示されます。" />}
        </div>
      </section>
    </div>
  );
}
