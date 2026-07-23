import { useEffect, useState, type FormEvent } from 'react';
import type { Habit, ISODate } from '../types';
import { useApp, createEntityBase } from '../state/AppContext';
import { addMonths, datesBetween, endOfMonth, formatMonth, startOfMonth, startOfWeek, todayISO } from '../lib/date';
import { habitStreak, periodHabitStats } from '../lib/stats';
import { ConfirmDialog, Dialog, EmptyState, Icon, ProgressBar } from '../components/ui';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const palette = ['#5fa67a', '#5c91cc', '#826fc1', '#d08a65', '#c278a2', '#4e9ab0'];

export function HabitsScreen({ selectedDate }: { selectedDate: ISODate }) {
  const { state, actions } = useApp();
  const [month, setMonth] = useState(startOfMonth(selectedDate));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit>();
  const [deleteHabit, setDeleteHabit] = useState<Habit>();
  const monthDays = datesBetween(startOfMonth(month), endOfMonth(month));
  const weekStart = startOfWeek(todayISO(), state.settings.weekStartsOn);
  const weekStats = periodHabitStats(state, weekStart, todayISO());
  const monthStats = periodHabitStats(state, startOfMonth(todayISO()), todayISO());

  const openForm = (habit?: Habit) => {
    setEditing(habit);
    setFormOpen(true);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">HABIT TRACKER</p><h1>習慣</h1><p>小さく続けた日を、静かに積み重ねます。</p></div>
        <button className="button button--primary" onClick={() => openForm()}><Icon name="plus" /> 習慣を追加</button>
      </header>

      <section className="summary-grid summary-grid--two">
        <article className="summary-card"><span className="summary-card__label">今週の達成率</span><strong>{weekStats.rate}<small>%</small></strong><ProgressBar value={weekStats.rate} /><p>{weekStats.completed}回達成</p></article>
        <article className="summary-card"><span className="summary-card__label">今月の達成率</span><strong>{monthStats.rate}<small>%</small></strong><ProgressBar value={monthStats.rate} /><p>{monthStats.completed}回達成</p></article>
      </section>

      <section className="habit-overview">
        {state.habits.length ? state.habits.map((habit) => {
          const streak = habitStreak(state, habit);
          const completedToday = state.habitRecords.some((record) => record.habitId === habit.id && record.date === selectedDate && record.completed);
          const weeklyCompleted = state.habitRecords.filter((record) => record.habitId === habit.id && record.completed && record.date >= weekStart && record.date <= todayISO()).length;
          return (
            <article key={habit.id} className={`habit-card ${!habit.active ? 'is-inactive' : ''}`}>
              <header>
                <span className="habit-card__icon" style={{ background: `${habit.color}1f`, color: habit.color }}>{habit.icon}</span>
                <div><h2>{habit.name}</h2><span>{habit.active ? '記録中' : '休止中'}</span></div>
                <button className="icon-button icon-button--small" onClick={() => openForm(habit)} aria-label={`${habit.name}を編集`}><Icon name="edit" /></button>
                <button className="icon-button icon-button--small icon-button--danger" onClick={() => setDeleteHabit(habit)} aria-label={`${habit.name}を削除`}><Icon name="trash" /></button>
              </header>
              <div className="habit-card__stats">
                <div><strong>{streak.current}</strong><span>連続日数</span></div>
                <div><strong>{streak.longest}</strong><span>最長記録</span></div>
                <div><strong>{weeklyCompleted}/7</strong><span>今週</span></div>
              </div>
              <button
                className={`habit-complete-button ${completedToday ? 'is-complete' : ''}`}
                onClick={() => actions.toggleHabit(habit.id, selectedDate)}
                disabled={!habit.active}
                aria-pressed={completedToday}
                aria-label={`${habit.name}の${selectedDate}を${completedToday ? '未達成' : '達成'}にする`}
              >
                <span>{completedToday && <Icon name="check" />}</span>
                {completedToday ? '達成しました' : `${selectedDate}を達成にする`}
              </button>
            </article>
          );
        }) : <EmptyState title="習慣がありません" description="毎日続けたいことを登録してみましょう。" />}
      </section>

      <section className="card-section habit-calendar">
        <div className="calendar-header">
          <button className="icon-button" onClick={() => setMonth(addMonths(month, -1))} aria-label="前月"><Icon name="chevronLeft" /></button>
          <h2>{formatMonth(month)}の記録</h2>
          <button className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="翌月"><Icon name="chevronRight" /></button>
        </div>
        <div className="habit-matrix-wrap">
          <table className="habit-matrix">
            <thead><tr><th>習慣</th>{monthDays.map((date) => <th key={date}>{Number(date.slice(-2))}</th>)}</tr></thead>
            <tbody>
              {state.habits.map((habit) => (
                <tr key={habit.id}>
                  <th><span style={{ color: habit.color }}>{habit.icon}</span>{habit.name}</th>
                  {monthDays.map((date) => {
                    const complete = state.habitRecords.some((record) => record.habitId === habit.id && record.date === date && record.completed);
                    return (
                      <td key={date}>
                        <button
                          className={complete ? 'is-complete' : ''}
                          onClick={() => actions.toggleHabit(habit.id, date)}
                          aria-label={`${date}の${habit.name}を${complete ? '未達成' : '達成'}にする`}
                          aria-pressed={complete}
                        >
                          {complete && <Icon name="check" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <HabitForm open={formOpen} habit={editing} onClose={() => { setFormOpen(false); setEditing(undefined); }} />
      <ConfirmDialog
        open={Boolean(deleteHabit)}
        title="習慣を削除しますか？"
        message={`「${deleteHabit?.name ?? ''}」とすべての達成記録を削除します。`}
        onClose={() => setDeleteHabit(undefined)}
        onConfirm={() => {
          if (deleteHabit) actions.deleteHabit(deleteHabit.id);
          setDeleteHabit(undefined);
        }}
      />
    </div>
  );
}

function HabitForm({ open, habit, onClose }: { open: boolean; habit?: Habit; onClose: () => void }) {
  const { state, actions } = useApp();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('習');
  const [color, setColor] = useState(palette[0]);
  const [active, setActive] = useState(true);
  const [goalId, setGoalId] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const discardGuard = useUnsavedChanges(open && dirty, onClose);

  useEffect(() => {
    if (open) {
      setName(habit?.name ?? '');
      setIcon(habit?.icon ?? '習');
      setColor(habit?.color ?? palette[0]);
      setActive(habit?.active ?? true);
      setGoalId(habit?.goalId ?? '');
      setReminderEnabled(habit?.reminderEnabled ?? false);
      setReminderTime(habit?.reminderTime ?? '20:00');
      setError('');
      setDirty(false);
    }
  }, [habit, open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('習慣名を入力してください。');
    actions.upsertHabit({
      ...(habit ?? createEntityBase(state.currentUser.id)),
      name: name.trim().slice(0, 80),
      icon: icon.trim().slice(0, 4) || '習',
      color,
      active,
      goalId: goalId || undefined,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : undefined,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <>
    <Dialog open={open} title={habit ? '習慣を編集' : '習慣を追加'} onClose={discardGuard.requestClose} closeOnBackdrop={false}>
      <form className="form-stack" onSubmit={submit} onInput={() => setDirty(true)}>
        <label className="field"><span>習慣名 <b aria-hidden="true">*</b></span><input autoFocus required maxLength={80} value={name} onChange={(event) => { setName(event.target.value); if (error) setError(''); }} placeholder="例：読書20分" aria-invalid={Boolean(error && !name.trim())} aria-describedby={error ? 'habit-form-error' : undefined} /></label>
        <div className="form-grid">
          <label className="field"><span>短い記号</span><input value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={4} placeholder="例：読" /></label>
          <div className="field"><span>色</span><div className="color-picker">{palette.map((value) => <button key={value} type="button" style={{ background: value }} className={color === value ? 'is-selected' : ''} onClick={() => setColor(value)} aria-label={`${value}を選択`} />)}</div></div>
        </div>
        <label className="field"><span>関連する目標</span><select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">関連なし</option>{state.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
        <label className="switch-row"><span><strong>記録を続ける</strong><small>オフにすると履歴を残したまま休止できます</small></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /></label>
        <label className="switch-row"><span><strong>習慣の通知</strong><small>未達成の場合、指定時刻にお知らせします</small></span><input type="checkbox" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} /></label>
        {reminderEnabled && <label className="field"><span>通知時刻</span><input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></label>}
        {error && <p id="habit-form-error" className="field-error" role="alert">{error}</p>}
        <div className="dialog__actions"><button className="button button--ghost" type="button" onClick={discardGuard.requestClose}>キャンセル</button><button className="button button--primary" type="submit">保存</button></div>
      </form>
    </Dialog>
    <ConfirmDialog
      open={discardGuard.confirmOpen}
      title="入力内容を破棄しますか？"
      message={`習慣「${name.trim() || '名称未入力'}」の未保存の変更があります。`}
      confirmLabel="破棄して閉じる"
      onClose={discardGuard.cancelDiscard}
      onConfirm={discardGuard.discard}
    />
    </>
  );
}
