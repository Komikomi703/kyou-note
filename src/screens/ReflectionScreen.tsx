import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { DailyReflection, ISODate, Mood } from '../types';
import { createEntityBase, useApp } from '../state/AppContext';
import { formatDate } from '../lib/date';
import { habitStatsForDate, taskStatsForDate } from '../lib/stats';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { ConfirmDialog, DateNavigator, EmptyState, Icon, ProgressBar } from '../components/ui';

const moods: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😄', label: '最高' },
  { value: 'good', emoji: '🙂', label: '良い' },
  { value: 'okay', emoji: '😌', label: '普通' },
  { value: 'tired', emoji: '😮‍💨', label: '疲れた' },
  { value: 'bad', emoji: '😔', label: '悪い' }
];

const makeReflection = (userId: string, date: ISODate, taskRate: number, habitRate: number): DailyReflection => ({
  ...createEntityBase(userId),
  date,
  mood: 'okay',
  wins: '',
  challenges: '',
  tomorrow: '',
  notes: '',
  attachmentIds: [],
  taskRate,
  habitRate
});

export function ReflectionScreen({ selectedDate, onDateChange }: { selectedDate: ISODate; onDateChange: (date: ISODate) => void }) {
  const { state, actions } = useApp();
  const existing = state.reflections.find((item) => item.date === selectedDate);
  const taskStats = taskStatsForDate(state.tasks, selectedDate);
  const habitStats = habitStatsForDate(state, selectedDate);
  const [draft, setDraft] = useState<DailyReflection>(() =>
    existing ?? makeReflection(state.currentUser.id, selectedDate, taskStats.rate, habitStats.rate)
  );
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const draftKey = `kyou-note:reflection-draft:${state.currentUser.id}:${selectedDate}`;

  useEffect(() => {
    const record = state.reflections.find((item) => item.date === selectedDate);
    try {
      const pending = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as DailyReflection | null;
      setDraft(
        pending?.date === selectedDate
          ? pending
          : record
            ? structuredClone(record)
            : makeReflection(state.currentUser.id, selectedDate, taskStats.rate, habitStats.rate)
      );
    } catch {
      setDraft(record ? structuredClone(record) : makeReflection(state.currentUser.id, selectedDate, taskStats.rate, habitStats.rate));
    }
  }, [draftKey, habitStats.rate, selectedDate, state.currentUser.id, state.reflections, taskStats.rate]);

  useEffect(() => setSaved(false), [selectedDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (existing && JSON.stringify(existing) === JSON.stringify(draft)) sessionStorage.removeItem(draftKey);
        else sessionStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // 下書き保存に失敗しても、入力中の画面は維持します。
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, existing]);

  const update = <K extends keyof DailyReflection>(key: K, value: DailyReflection[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = (event: FormEvent) => {
    event.preventDefault();
    const next = {
      ...draft,
      taskRate: taskStats.rate,
      habitRate: habitStats.rate,
      updatedAt: new Date().toISOString()
    };
    actions.upsertReflection(next);
    setDraft(next);
    sessionStorage.removeItem(draftKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const recent = useMemo(
    () => [...state.reflections].sort((a, b) => b.date.localeCompare(a.date)).filter((item) => item.date !== selectedDate).slice(0, 7),
    [selectedDate, state.reflections]
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">DAILY REFLECTION</p><h1>振り返り</h1><p>良かったことも難しかったことも、ありのまま残せます。</p></div>
        <DateNavigator date={selectedDate} onChange={onDateChange} />
      </header>

      <div className="reflection-layout">
        <form className="card-section reflection-form" onSubmit={save}>
          <div className="section-heading">
            <div><span className="section-kicker">{selectedDate}</span><h2>{formatDate(selectedDate)}の記録</h2></div>
            {existing && <button type="button" className="button button--text button--danger-text" onClick={() => setConfirmDelete(true)}><Icon name="trash" /> 削除</button>}
          </div>

          <fieldset className="mood-picker">
            <legend>今日の気分</legend>
            <div>
              {moods.map((mood) => (
                <label key={mood.value} className={draft.mood === mood.value ? 'is-selected' : ''}>
                  <input type="radio" name="mood" value={mood.value} checked={draft.mood === mood.value} onChange={() => update('mood', mood.value)} />
                  <span aria-hidden="true">{mood.emoji}</span><strong>{mood.label}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="reflection-rates">
            <div><span>タスク達成率</span><strong>{taskStats.rate}%</strong><ProgressBar value={taskStats.rate} /></div>
            <div><span>習慣達成率</span><strong>{habitStats.rate}%</strong><ProgressBar value={habitStats.rate} /></div>
          </div>
          <label className="field"><span>今日できたこと</span><textarea rows={3} maxLength={5000} value={draft.wins} onChange={(event) => update('wins', event.target.value)} placeholder="小さなことでも大丈夫です" /></label>
          <label className="field"><span>うまくいかなかったこと</span><textarea rows={3} maxLength={5000} value={draft.challenges} onChange={(event) => update('challenges', event.target.value)} placeholder="責めずに、事実を振り返ってみましょう" /></label>
          <label className="field"><span>明日やること</span><textarea rows={3} maxLength={5000} value={draft.tomorrow} onChange={(event) => update('tomorrow', event.target.value)} placeholder="明日の自分に渡すメモ" /></label>
          <label className="field"><span>自由記述</span><textarea rows={5} maxLength={10000} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="感じたこと、考えたことを自由に" /></label>
          <div className="field"><span>写真・画像</span><AttachmentPicker ownerType="reflection" ownerId={draft.id} attachmentIds={draft.attachmentIds} onChange={(ids) => update('attachmentIds', ids)} /></div>
          <div className="form-save-row">
            {saved && <span className="save-success" role="status"><Icon name="check" /> 保存しました</span>}
            <button className="button button--primary" type="submit">{existing ? '変更を保存' : '振り返りを保存'}</button>
          </div>
        </form>

        <aside className="recent-reflections">
          <h2>最近の記録</h2>
          {recent.map((reflection) => (
            <button key={reflection.id} onClick={() => onDateChange(reflection.date)} className="reflection-history-card">
              <span>{moods.find((mood) => mood.value === reflection.mood)?.emoji}</span>
              <div><strong>{formatDate(reflection.date)}</strong><p>{reflection.wins || reflection.notes || '記録を見る'}</p></div>
              <Icon name="chevronRight" />
            </button>
          ))}
          {!recent.length && <EmptyState title="まだ記録がありません" description="保存した振り返りがここに並びます。" />}
        </aside>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="振り返りを削除しますか？"
        message={`${selectedDate}の文章と添付画像を削除します。`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (existing) actions.deleteReflection(existing.id);
          sessionStorage.removeItem(draftKey);
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}
