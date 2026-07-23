import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Goal } from '../types';
import { useApp, createEntityBase } from '../state/AppContext';
import { todayISO } from '../lib/date';
import { ConfirmDialog, Dialog, EmptyState, Icon, ProgressBar } from '../components/ui';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export function GoalsScreen() {
  const { state, actions } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal>();
  const [parentId, setParentId] = useState<string>();
  const [deleteGoal, setDeleteGoal] = useState<Goal>();
  const roots = state.goals.filter((goal) => !goal.parentGoalId);

  const openForm = (goal?: Goal, parent?: string) => {
    setEditing(goal);
    setParentId(parent);
    setFormOpen(true);
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div><p className="eyebrow">GOALS</p><h1>目標</h1><p>大きな目標を、小さな進捗へ分けて育てます。</p></div>
        <button className="button button--primary" onClick={() => openForm()}><Icon name="plus" /> 目標を追加</button>
      </header>

      <section className="goals-grid">
        {roots.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onEdit={openForm}
            onDelete={setDeleteGoal}
            onAddChild={(id) => openForm(undefined, id)}
          />
        ))}
        {!roots.length && (
          <EmptyState
            icon="goals"
            title="目標を作ってみましょう"
            description="達成したいことと、そこへ向かう小さな目標を登録できます。"
            action={<button className="button button--primary" onClick={() => openForm()}>最初の目標を追加</button>}
          />
        )}
      </section>
      <GoalForm open={formOpen} goal={editing} initialParentId={parentId} onClose={() => { setFormOpen(false); setEditing(undefined); setParentId(undefined); }} />
      <ConfirmDialog
        open={Boolean(deleteGoal)}
        title="目標を削除しますか？"
        message={`「${deleteGoal?.title ?? ''}」と、その小目標を削除します。関連タスクや習慣そのものは残ります。`}
        onClose={() => setDeleteGoal(undefined)}
        onConfirm={() => {
          if (deleteGoal) actions.deleteGoal(deleteGoal.id);
          setDeleteGoal(undefined);
        }}
      />
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddChild
}: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onAddChild: (id: string) => void;
}) {
  const { state } = useApp();
  const children = state.goals.filter((item) => item.parentGoalId === goal.id);
  const relatedTasks = state.tasks.filter((task) => task.goalId === goal.id || goal.taskIds.includes(task.id));
  const relatedHabits = state.habits.filter((habit) => habit.goalId === goal.id || goal.habitIds.includes(habit.id));
  return (
    <article className={`goal-card ${goal.completed ? 'is-complete' : ''}`}>
      <header>
        <div className="goal-card__target"><Icon name="goals" /></div>
        <div><span className="goal-status">{goal.completed ? '達成済み' : goal.progressMode === 'auto' ? '自動計算' : '手動'}</span><h2>{goal.title}</h2></div>
        <div className="goal-card__actions">
          <button className="icon-button icon-button--small" onClick={() => onEdit(goal)} aria-label={`${goal.title}を編集`}><Icon name="edit" /></button>
          <button className="icon-button icon-button--small icon-button--danger" onClick={() => onDelete(goal)} aria-label={`${goal.title}を削除`}><Icon name="trash" /></button>
        </div>
      </header>
      {goal.description && <p>{goal.description}</p>}
      <div className="goal-progress"><div><span>進捗</span><strong>{goal.progress}%</strong></div><ProgressBar value={goal.progress} /></div>
      <div className="goal-meta">
        <span>開始 {goal.startDate}</span>{goal.dueDate && <span>期限 {goal.dueDate}</span>}
        <span>タスク {relatedTasks.filter((task) => task.completed).length}/{relatedTasks.length}</span>
        <span>習慣 {relatedHabits.length}</span>
      </div>
      {goal.attachmentIds.length > 0 && (
        <div className="task-images">
          {state.attachments
            .filter((attachment) => goal.attachmentIds.includes(attachment.id))
            .map((attachment) => <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} />)}
        </div>
      )}
      <div className="subgoals">
        <div className="subgoals__heading"><h3>小目標</h3><button className="button button--text" onClick={() => onAddChild(goal.id)}><Icon name="plus" /> 追加</button></div>
        {children.map((child) => (
          <button className="subgoal-row" key={child.id} onClick={() => onEdit(child)}>
            <span className={child.completed ? 'is-complete' : ''}>{child.completed && <Icon name="check" />}</span>
            <span>{child.title}</span>
            <strong>{child.progress}%</strong>
          </button>
        ))}
        {!children.length && <p className="muted">小さなステップに分けると進めやすくなります。</p>}
      </div>
    </article>
  );
}

function GoalForm({ open, goal, initialParentId, onClose }: { open: boolean; goal?: Goal; initialParentId?: string; onClose: () => void }) {
  const { state, actions } = useApp();
  const [draft, setDraft] = useState<Goal>(() => ({
    ...createEntityBase(state.currentUser.id),
    title: '',
    description: '',
    startDate: todayISO(),
    progress: 0,
    progressMode: 'auto',
    taskIds: [],
    habitIds: [],
    attachmentIds: [],
    completed: false,
    pointsAwarded: false
  }));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const discardGuard = useUnsavedChanges(open && dirty, onClose);

  useEffect(() => {
    if (!open) return;
    setDraft(goal ? structuredClone(goal) : {
      ...createEntityBase(state.currentUser.id),
      title: '',
      description: '',
      startDate: todayISO(),
      progress: 0,
      progressMode: 'auto',
      taskIds: [],
      habitIds: [],
      attachmentIds: [],
      parentGoalId: initialParentId,
      completed: false,
      pointsAwarded: false
    });
    setError('');
    setDirty(false);
  }, [goal, initialParentId, open, state.currentUser.id]);

  const update = <K extends keyof Goal>(key: K, value: Goal[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const candidates = useMemo(() => state.goals.filter((item) => item.id !== draft.id && !item.parentGoalId), [draft.id, state.goals]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return setError('目標名を入力してください。');
    const completed = draft.progress >= 100 || draft.completed;
    actions.upsertGoal({
      ...draft,
      title: draft.title.trim().slice(0, 120),
      description: draft.description.slice(0, 5000),
      progress: completed ? 100 : Math.max(0, Math.min(99, draft.progress)),
      completed,
      completedAt: completed ? draft.completedAt ?? new Date().toISOString() : undefined,
      pointsAwarded: completed,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  const toggleId = (key: 'taskIds' | 'habitIds', id: string) => {
    const values = draft[key];
    update(key, values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  };

  return (
    <>
    <Dialog open={open} title={goal ? '目標を編集' : '目標を追加'} onClose={discardGuard.requestClose} wide closeOnBackdrop={false}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field"><span>目標名 <b aria-hidden="true">*</b></span><input autoFocus required maxLength={120} value={draft.title} onChange={(event) => { update('title', event.target.value); if (error) setError(''); }} placeholder="例：ITパスポートに合格する" aria-invalid={Boolean(error && !draft.title.trim())} aria-describedby={error ? 'goal-form-error' : undefined} /></label>
        <label className="field"><span>説明</span><textarea rows={3} maxLength={5000} value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="達成したい理由や基準" /></label>
        <div className="form-grid">
          <label className="field"><span>開始日</span><input type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} /></label>
          <label className="field"><span>達成期限</span><input type="date" min={draft.startDate} value={draft.dueDate ?? ''} onChange={(event) => update('dueDate', event.target.value || undefined)} /></label>
          <label className="field"><span>大きな目標</span><select value={draft.parentGoalId ?? ''} onChange={(event) => update('parentGoalId', event.target.value || undefined)}><option value="">なし（大目標）</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="field"><span>進捗の計算</span><select value={draft.progressMode} onChange={(event) => update('progressMode', event.target.value as 'auto' | 'manual')}><option value="auto">関連項目から自動</option><option value="manual">手動で入力</option></select></label>
        </div>
        {draft.progressMode === 'manual' && <label className="field"><span>進捗率 {draft.progress}%</span><input type="range" min="0" max="100" value={draft.progress} onChange={(event) => update('progress', Number(event.target.value))} /></label>}
        <fieldset className="form-section"><legend>関連するタスク</legend><div className="check-grid">
          {state.tasks.filter((task) => !task.recurrenceSourceId).map((task) => <label key={task.id}><input type="checkbox" checked={draft.taskIds.includes(task.id)} onChange={() => toggleId('taskIds', task.id)} /><span>{task.title}</span></label>)}
          {!state.tasks.length && <p className="muted">タスクを作成するとここで関連付けできます。</p>}
        </div></fieldset>
        <fieldset className="form-section"><legend>関連する習慣</legend><div className="check-grid">
          {state.habits.map((habit) => <label key={habit.id}><input type="checkbox" checked={draft.habitIds.includes(habit.id)} onChange={() => toggleId('habitIds', habit.id)} /><span>{habit.icon} {habit.name}</span></label>)}
        </div></fieldset>
        <div className="field"><span>画像・写真</span><AttachmentPicker ownerType="goal" ownerId={draft.id} attachmentIds={draft.attachmentIds} onChange={(ids) => update('attachmentIds', ids)} /></div>
        <label className="switch-row"><span><strong>達成済みにする</strong><small>進捗率も100%になります</small></span><input type="checkbox" checked={draft.completed} onChange={(event) => { update('completed', event.target.checked); if (event.target.checked) update('progress', 100); }} /></label>
        {error && <p id="goal-form-error" className="field-error" role="alert">{error}</p>}
        <div className="dialog__actions"><button className="button button--ghost" type="button" onClick={discardGuard.requestClose}>キャンセル</button><button className="button button--primary" type="submit">保存</button></div>
      </form>
    </Dialog>
    <ConfirmDialog
      open={discardGuard.confirmOpen}
      title="入力内容を破棄しますか？"
      message={`目標「${draft.title.trim() || '名称未入力'}」の未保存の変更があります。`}
      confirmLabel="破棄して閉じる"
      onClose={discardGuard.cancelDiscard}
      onConfirm={discardGuard.discard}
    />
    </>
  );
}
