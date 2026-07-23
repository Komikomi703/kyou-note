import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ISODate, Priority, RepeatType, Subtask, Task } from '../types';
import { createEntityBase, useApp } from '../state/AppContext';
import { ConfirmDialog, Dialog, Icon } from './ui';
import { AttachmentPicker } from './AttachmentPicker';
import { hasGoogleCalendarToken, updateGoogleEvent } from '../services/googleCalendar';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

const defaultTask = (userId: string, date: ISODate): Task => ({
  ...createEntityBase(userId),
  title: '',
  date,
  priority: 'normal',
  notes: '',
  completed: false,
  recurrence: { type: 'none', weekdays: [], intervalDays: 2 },
  reminders: [],
  subtasks: [],
  attachmentIds: [],
  pointsAwarded: false
});

export function TaskForm({
  open,
  initialDate,
  task,
  onClose
}: {
  open: boolean;
  initialDate: ISODate;
  task?: Task;
  onClose: () => void;
}) {
  const { state, actions } = useApp();
  const [draft, setDraft] = useState<Task>(() => task ?? defaultTask(state.currentUser.id, initialDate));
  const [error, setError] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [dirty, setDirty] = useState(false);
  const title = task ? 'タスクを編集' : '新しいタスク';
  const discardGuard = useUnsavedChanges(open && dirty && !savedLocally, onClose);

  useEffect(() => {
    if (open) {
      setDraft(task ? structuredClone(task) : defaultTask(state.currentUser.id, initialDate));
      setError('');
      setSubtaskTitle('');
      setSaving(false);
      setSavedLocally(false);
      setDirty(false);
    }
  }, [initialDate, open, state.currentUser.id, task]);

  const update = <K extends keyof Task>(key: K, value: Task[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSavedLocally(false);
    if (error) setError('');
  };
  const reminder = draft.reminders[0];
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const taskProgress = draft.subtasks.length
    ? Math.round((draft.subtasks.filter((item) => item.completed).length / draft.subtasks.length) * 100)
    : 0;

  const categories = useMemo(() => [...state.categories].sort((a, b) => a.name.localeCompare(b.name, 'ja')), [state.categories]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const trimmed = draft.title.trim();
    if (!trimmed) {
      setError('タスク名を入力してください。');
      return;
    }
    if (draft.deadline && draft.startTime && draft.deadline < draft.startTime) {
      setError('期限は開始時間より後にしてください。');
      return;
    }
    if (draft.recurrence.type === 'weekdays-custom' && draft.recurrence.weekdays.length === 0) {
      setError('繰り返す曜日を1つ以上選択してください。');
      return;
    }
    if (reminder?.kind === 'start' && !draft.startTime) {
      setError('開始前に通知するには開始時間を設定してください。');
      return;
    }
    if (reminder?.kind === 'deadline' && !draft.deadline) {
      setError('期限前に通知するには期限を設定してください。');
      return;
    }
    setSaving(true);
    setError('');
    const completedBySubtasks = draft.subtasks.length > 0 && draft.subtasks.every((item) => item.completed);
    const savedTask: Task = {
      ...draft,
      title: trimmed.slice(0, 120),
      notes: draft.notes.slice(0, 5000),
      completed: draft.completed || completedBySubtasks,
      completedAt: draft.completed || completedBySubtasks ? draft.completedAt ?? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };
    actions.upsertTask(savedTask);
    setSavedLocally(true);
    setDirty(false);
    if (savedTask.googleEventId) {
      if (!hasGoogleCalendarToken()) {
        setError('タスクは端末に保存しました。Google予定の更新には設定画面から再連携が必要です。');
        setSaving(false);
        return;
      }
      try {
        await updateGoogleEvent(savedTask);
      } catch (reason) {
        setError(reason instanceof Error ? `タスクは端末に保存しました。${reason.message}` : 'タスクは保存しましたが、Google予定を更新できませんでした。');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onClose();
  };

  const setReminderEnabled = (enabled: boolean) => {
    update(
      'reminders',
      enabled
        ? [{ enabled: true, kind: 'start', minutesBefore: 10 }]
        : []
    );
  };

  const addSubtask = () => {
    const value = subtaskTitle.trim();
    if (!value) return;
    update('subtasks', [...draft.subtasks, { id: crypto.randomUUID(), title: value.slice(0, 120), completed: false }]);
    setSubtaskTitle('');
  };

  const updateSubtask = (id: string, patch: Partial<Subtask>) =>
    update('subtasks', draft.subtasks.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <>
    <Dialog open={open} title={title} onClose={discardGuard.requestClose} wide closeOnBackdrop={false}>
      <form className="form-stack" onSubmit={submit} onInput={() => setDirty(true)}>
        <label className="field field--wide">
          <span>タスク名 <b aria-hidden="true">*</b></span>
          <input
            autoFocus
            required
            value={draft.title}
            maxLength={120}
            onChange={(event) => update('title', event.target.value)}
            placeholder="例：Pythonを30分"
            aria-invalid={Boolean(error && !draft.title.trim())}
            aria-describedby={error ? 'task-form-error' : undefined}
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>日付</span>
            <input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required />
          </label>
          <label className="field">
            <span>開始時間</span>
            <input type="time" value={draft.startTime ?? ''} onChange={(event) => update('startTime', event.target.value || undefined)} />
          </label>
          <label className="field">
            <span>期限</span>
            <input type="time" value={draft.deadline ?? ''} onChange={(event) => update('deadline', event.target.value || undefined)} />
          </label>
          <label className="field">
            <span>所要時間（分）</span>
            <input
              type="number"
              min="1"
              max="1440"
              value={draft.durationMinutes ?? ''}
              onChange={(event) => update('durationMinutes', event.target.value ? Number(event.target.value) : undefined)}
              placeholder="30"
            />
          </label>
          <label className="field">
            <span>カテゴリー</span>
            <select value={draft.categoryId ?? ''} onChange={(event) => update('categoryId', event.target.value || undefined)}>
              <option value="">未設定</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>優先度</span>
            <select value={draft.priority} onChange={(event) => update('priority', event.target.value as Priority)}>
              <option value="important">重要</option>
              <option value="normal">普通</option>
              <option value="someday">余裕があれば</option>
            </select>
          </label>
          <label className="field field--wide">
            <span>関連する目標</span>
            <select value={draft.goalId ?? ''} onChange={(event) => update('goalId', event.target.value || undefined)}>
              <option value="">関連なし</option>
              {state.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="form-section">
          <legend>繰り返し</legend>
          <div className="form-grid">
            <label className="field">
              <span>頻度</span>
              <select
                value={draft.recurrence.type}
                onChange={(event) =>
                  update('recurrence', { ...draft.recurrence, type: event.target.value as RepeatType })
                }
              >
                <option value="none">繰り返しなし</option>
                <option value="daily">毎日</option>
                <option value="weekdays">平日のみ</option>
                <option value="weekly">毎週</option>
                <option value="weekdays-custom">曜日指定</option>
                <option value="monthly">毎月</option>
                <option value="interval">指定日数ごと</option>
              </select>
            </label>
            {draft.recurrence.type === 'interval' && (
              <label className="field">
                <span>間隔（日）</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={draft.recurrence.intervalDays}
                  onChange={(event) =>
                    update('recurrence', { ...draft.recurrence, intervalDays: Math.max(1, Number(event.target.value)) })
                  }
                />
              </label>
            )}
            {draft.recurrence.type !== 'none' && (
              <label className="field">
                <span>終了日（任意）</span>
                <input
                  type="date"
                  min={draft.date}
                  value={draft.recurrence.endDate ?? ''}
                  onChange={(event) =>
                    update('recurrence', { ...draft.recurrence, endDate: event.target.value || undefined })
                  }
                />
              </label>
            )}
          </div>
          {draft.recurrence.type === 'weekdays-custom' && (
            <div className="weekday-picker" aria-label="曜日を選択">
              {weekdays.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className={draft.recurrence.weekdays.includes(day) ? 'is-selected' : ''}
                  aria-pressed={draft.recurrence.weekdays.includes(day)}
                  onClick={() =>
                    update('recurrence', {
                      ...draft.recurrence,
                      weekdays: draft.recurrence.weekdays.includes(day)
                        ? draft.recurrence.weekdays.filter((value) => value !== day)
                        : [...draft.recurrence.weekdays, day].sort()
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="form-section">
          <legend>通知</legend>
          <label className="switch-row">
            <span>
              <strong>タスクのリマインダー</strong>
              <small>通知が使えない場合はアプリ内でお知らせします</small>
            </span>
            <input type="checkbox" checked={Boolean(reminder)} onChange={(event) => setReminderEnabled(event.target.checked)} />
          </label>
          {reminder && (
            <div className="form-grid">
              <label className="field">
                <span>タイミング</span>
                <select
                  value={reminder.kind}
                  onChange={(event) =>
                    update('reminders', [{ ...reminder, kind: event.target.value as 'start' | 'deadline' | 'custom' }])
                  }
                >
                  <option value="start">開始前</option>
                  <option value="deadline">期限前</option>
                  <option value="custom">指定時刻</option>
                </select>
              </label>
              {reminder.kind === 'custom' ? (
                <label className="field">
                  <span>通知時刻</span>
                  <input
                    type="time"
                    value={reminder.customTime ?? '09:00'}
                    onChange={(event) => update('reminders', [{ ...reminder, customTime: event.target.value }])}
                  />
                </label>
              ) : (
                <label className="field">
                  <span>何分前</span>
                  <select
                    value={reminder.minutesBefore}
                    onChange={(event) => update('reminders', [{ ...reminder, minutesBefore: Number(event.target.value) }])}
                  >
                    {[0, 5, 10, 15, 30, 60, 1440].map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes === 1440 ? '1日前' : `${minutes}分前`}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="form-section">
          <legend>サブタスク {draft.subtasks.length > 0 && `（${taskProgress}%）`}</legend>
          <div className="inline-form">
            <input
              value={subtaskTitle}
              maxLength={120}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="小さな作業を追加"
              aria-label="サブタスク名"
            />
            <button type="button" className="button button--ghost" onClick={addSubtask}>追加</button>
          </div>
          <div className="subtask-editor">
            {draft.subtasks.map((subtask) => (
              <div key={subtask.id} className="subtask-editor__row">
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })}
                  aria-label={`${subtask.title}を完了`}
                />
                <input
                  value={subtask.title}
                  onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })}
                  aria-label="サブタスク名"
                />
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => update('subtasks', draft.subtasks.filter((item) => item.id !== subtask.id))}
                  aria-label={`${subtask.title}を削除`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>メモ</span>
          <textarea
            rows={4}
            maxLength={5000}
            value={draft.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="資料、場所、補足など"
          />
        </label>

        <div className="field">
          <span>画像・写真</span>
          <AttachmentPicker
            ownerType="task"
            ownerId={draft.id}
            attachmentIds={draft.attachmentIds}
            onChange={(ids) => update('attachmentIds', ids)}
          />
        </div>

        {error && <p id="task-form-error" className="field-error" role="alert">{error}</p>}
        <div className="dialog__actions dialog__actions--sticky">
          <button className="button button--ghost" type="button" disabled={saving} onClick={discardGuard.requestClose}>{savedLocally ? '閉じる' : 'キャンセル'}</button>
          <button className="button button--primary" type="submit" disabled={saving || savedLocally}>
            {saving ? '保存中…' : savedLocally ? '端末に保存済み' : task ? '変更を保存' : 'タスクを追加'}
          </button>
        </div>
      </form>
    </Dialog>
    <ConfirmDialog
      open={discardGuard.confirmOpen}
      title="入力内容を破棄しますか？"
      message={`タスク「${draft.title.trim() || '名称未入力'}」の未保存の変更があります。閉じると入力内容は失われます。`}
      confirmLabel="破棄して閉じる"
      onClose={discardGuard.cancelDiscard}
      onConfirm={discardGuard.discard}
    />
    </>
  );
}
