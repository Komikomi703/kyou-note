import { useState } from 'react';
import type { ISODate, Task } from '../types';
import { createEntityBase, useApp } from '../state/AppContext';
import { recurrenceLabel } from '../lib/recurrence';
import { deleteGoogleEvent } from '../services/googleCalendar';
import { ConfirmDialog, Dialog, Icon, ProgressBar } from './ui';

const priorityLabels = { important: '重要', normal: '普通', someday: '余裕があれば' };

export function TaskCard({
  task,
  date,
  onEdit,
  compact = false
}: {
  task: Task;
  date: ISODate;
  onEdit: (task: Task) => void;
  compact?: boolean;
}) {
  const { state, actions } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [googleDeleteError, setGoogleDeleteError] = useState('');
  const category = state.categories.find((item) => item.id === task.categoryId);
  const goal = state.goals.find((item) => item.id === task.goalId);
  const subtaskProgress = task.subtasks.length
    ? Math.round((task.subtasks.filter((item) => item.completed).length / task.subtasks.length) * 100)
    : undefined;

  const updateSubtask = (id: string, completed: boolean) => {
    const subtasks = task.subtasks.map((item) => (item.id === id ? { ...item, completed } : item));
    const allCompleted = subtasks.length > 0 && subtasks.every((item) => item.completed);
    actions.upsertTask({
      ...task,
      subtasks,
      completed: allCompleted,
      completedAt: allCompleted ? task.completedAt ?? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    });
  };

  const duplicateTask = () => {
    actions.upsertTask({
      ...structuredClone(task),
      ...createEntityBase(state.currentUser.id),
      title: `${task.title}（コピー）`.slice(0, 120),
      date,
      completed: false,
      completedAt: undefined,
      pointsAwarded: false,
      recurrence: { type: 'none', weekdays: [], intervalDays: 1 },
      recurrenceSourceId: undefined,
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: crypto.randomUUID(), completed: false })),
      attachmentIds: [],
      googleEventId: undefined,
      googleCalendarId: undefined
    });
  };

  return (
    <>
      <article className={`task-card ${task.completed ? 'is-complete' : ''} priority-${task.priority} ${compact ? 'task-card--compact' : ''}`}>
        <button
          className="task-check"
          aria-label={`${task.title}を${task.completed ? '未完了' : '完了'}にする`}
          aria-pressed={task.completed}
          onClick={() => actions.toggleTask(task, date)}
        >
          {task.completed && <Icon name="check" />}
        </button>
        <div className="task-card__content">
          <div className="task-card__topline">
            <h3>{task.title}</h3>
            <span className={`priority-badge priority-badge--${task.priority}`}>{priorityLabels[task.priority]}</span>
          </div>
          <div className="task-meta">
            {task.startTime && <span>開始 {task.startTime}</span>}
            {task.deadline && <span>期限 {task.deadline}</span>}
            {task.durationMinutes && <span>{task.durationMinutes}分</span>}
            {category && <span className="category-chip"><i style={{ background: category.color }} />{category.name}</span>}
            {task.recurrence.type !== 'none' && <span>↻ {recurrenceLabel(task.recurrence)}</span>}
            {task.reminders.some((item) => item.enabled) && <span><Icon name="bell" /> 通知</span>}
          </div>
          {task.notes && !compact && <p className="task-card__notes">{task.notes}</p>}
          {goal && !compact && <p className="task-card__goal">目標：{goal.title}</p>}
          {subtaskProgress !== undefined && !compact && (
            <div className="task-card__subtasks">
              <ProgressBar value={subtaskProgress} label={`${task.subtasks.filter((item) => item.completed).length}/${task.subtasks.length}`} subtle />
              {task.subtasks.map((subtask) => (
                <label key={subtask.id}>
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={(event) => updateSubtask(subtask.id, event.target.checked)}
                  />
                  <span>{subtask.title}</span>
                </label>
              ))}
            </div>
          )}
          {task.attachmentIds.length > 0 && !compact && (
            <div className="task-images">
              {state.attachments
                .filter((attachment) => task.attachmentIds.includes(attachment.id))
                .map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}
            </div>
          )}
        </div>
        <div className="task-card__actions">
          <button className="icon-button icon-button--small" onClick={duplicateTask} aria-label={`${task.title}を複製`}>
            <Icon name="copy" />
          </button>
          <button className="icon-button icon-button--small" onClick={() => onEdit(task)} aria-label={`${task.title}を編集`}>
            <Icon name="edit" />
          </button>
          <button className="icon-button icon-button--small icon-button--danger" onClick={() => setConfirmDelete(true)} aria-label={`${task.title}を削除`}>
            <Icon name="trash" />
          </button>
        </div>
      </article>
      <ConfirmDialog
        open={confirmDelete && !task.googleEventId}
        title="タスクを削除しますか？"
        message={task.recurrence.type !== 'none' ? `「${task.title}」と今後の繰り返しを削除します。削除後7秒間は元に戻せます。` : `「${task.title}」を削除します。削除後7秒間は元に戻せます。`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          actions.deleteTask(task.id);
          setConfirmDelete(false);
        }}
      />
      <Dialog open={confirmDelete && Boolean(task.googleEventId)} title="連携済みタスクを削除" onClose={() => setConfirmDelete(false)}>
        <div className="form-stack">
          <p>「{task.title}」はGoogleカレンダーにも登録されています。Google側の予定も削除しますか？</p>
          {googleDeleteError && <p className="field-error" role="alert">{googleDeleteError}</p>}
          <div className="dialog__actions">
            <button className="button button--ghost" onClick={() => setConfirmDelete(false)}>キャンセル</button>
            <button className="button button--ghost" onClick={() => { actions.deleteTask(task.id); setConfirmDelete(false); }}>今日ノートだけ削除</button>
            <button
              className="button button--danger"
              onClick={() => void deleteGoogleEvent(task)
                .then(() => {
                  actions.deleteTask(task.id, false);
                  setConfirmDelete(false);
                })
                .catch((reason) => setGoogleDeleteError(reason instanceof Error ? reason.message : 'Google予定を削除できませんでした。'))}
            >
              両方から削除
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
