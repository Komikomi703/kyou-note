import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AppState, Category, GoogleCalendar, Screen, Task } from '../types';
import { createEntityBase, useApp } from '../state/AppContext';
import { clearState, exportState, importState } from '../data/storage';
import { countUserData, mergeAppStates, reassignStateUser } from '../data/sync';
import { createInitialState } from '../data/seed';
import { pointsTotal, levelForPoints, titleForLevel } from '../lib/stats';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import {
  connectGoogleCalendar,
  createGoogleEvent,
  disconnectGoogleCalendar,
  fetchGoogleCalendars,
  fetchGoogleEvents,
  hasGoogleCalendarToken,
  isGoogleCalendarConfigured
} from '../services/googleCalendar';
import { notificationSupport, requestNotificationPermission, showTestNotification } from '../services/notifications';
import { getPwaInstallStatus, requestPwaInstall, subscribeInstallStatus } from '../services/pwa';
import { ConfirmDialog, Dialog, Icon, ProgressBar, Toast } from '../components/ui';
import { userFacingError } from '../lib/errors';

export function SettingsScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { state, actions, cloudSyncStatus, cloudSyncError, pendingSyncCount } = useApp();
  const importRef = useRef<HTMLInputElement>(null);
  const [categoryName, setCategoryName] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState(state.settings.displayName);
  const [editingCategory, setEditingCategory] = useState<Category>();
  const [deleteCategory, setDeleteCategory] = useState<Category>();
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardCost, setRewardCost] = useState(100);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAccountDelete, setConfirmAccountDelete] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    notificationSupport() === 'supported' ? Notification.permission : 'unsupported'
  );
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string }>();
  const [syncing, setSyncing] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(hasGoogleCalendarToken());
  const [calendarTask, setCalendarTask] = useState<Task>();
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);
  const [, setInstallStatusVersion] = useState(0);
  const [pendingImport, setPendingImport] = useState<AppState>();
  const totalPoints = pointsTotal(state);
  const level = levelForPoints(totalPoints);
  const pwaStatus = getPwaInstallStatus();
  const offlineReady = 'serviceWorker' in navigator;

  useEffect(() => subscribeInstallStatus(() => setInstallStatusVersion((value) => value + 1)), []);
  useEffect(() => setDisplayNameDraft(state.settings.displayName), [state.currentUser.id, state.settings.displayName]);

  const saveDisplayName = () => {
    const value = displayNameDraft.trim().slice(0, 40);
    if (!value) {
      setDisplayNameDraft(state.settings.displayName);
      notify('表示名は1文字以上で入力してください。', 'error');
      return;
    }
    if (value !== state.settings.displayName) actions.updateSettings({ displayName: value });
    setDisplayNameDraft(value);
  };

  const notify = (text: string, tone: 'success' | 'error' | 'info' = 'success') => {
    setMessage({ text, tone });
    window.setTimeout(() => setMessage(undefined), 3500);
  };

  const saveCategory = (event: FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) {
      notify('カテゴリー名を入力してください。', 'error');
      return;
    }
    if (state.categories.some((category) => category.id !== editingCategory?.id && category.name.localeCompare(name, 'ja', { sensitivity: 'accent' }) === 0)) {
      notify('同じ名前のカテゴリーがすでにあります。', 'error');
      return;
    }
    const category: Category = editingCategory
      ? { ...editingCategory, name: name.slice(0, 40), updatedAt: new Date().toISOString() }
      : { ...createEntityBase(state.currentUser.id), name: name.slice(0, 40), color: '#5c91cc', isDefault: false };
    actions.upsertCategory(category);
    setCategoryName('');
    setEditingCategory(undefined);
  };

  const addReward = (event: FormEvent) => {
    event.preventDefault();
    if (!rewardTitle.trim() || rewardCost < 1) {
      notify('ご褒美名と1以上の必要ポイントを入力してください。', 'error');
      return;
    }
    actions.upsertReward({
      ...createEntityBase(state.currentUser.id),
      title: rewardTitle.trim().slice(0, 80),
      cost: rewardCost,
      redeemed: false
    });
    setRewardTitle('');
    setRewardCost(100);
  };

  const download = (content: string, type: string, extension: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kyou-note-${new Date().toISOString().slice(0, 10)}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = ['種別', '日付', '名前', 'カテゴリー', '優先度', '完了', 'メモ'];
    const rows = state.tasks.map((task) => [
      'タスク', task.date, task.title, state.categories.find((item) => item.id === task.categoryId)?.name ?? '',
      task.priority, task.completed ? '完了' : '未完了', task.notes
    ]);
    download(`\ufeff${[header, ...rows].map((row) => row.map(escape).join(',')).join('\n')}`, 'text/csv;charset=utf-8', 'csv');
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('インポートファイルは5MB以下にしてください。');
      const imported = importState(await file.text());
      setPendingImport({
        ...reassignStateUser(imported, state.currentUser.id),
        currentUser: state.currentUser
      });
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : '読み込みに失敗しました。', 'error');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const enableNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      actions.updateSettings({ notificationsEnabled: true });
      if (isFirebaseConfigured && state.currentUser.provider !== 'local') {
        try {
          const { enableFirebaseMessaging } = await import('../services/firebase');
          const cloudPush = await enableFirebaseMessaging(state.currentUser.id, (title, body) => notify(`${title}: ${body}`, 'info'));
          notify(cloudPush ? '通知とクラウドメッセージを有効にしました。' : '端末内のPWA通知を有効にしました。');
        } catch {
          notify('端末内のPWA通知を有効にしました。クラウド通知は設定を確認してください。', 'info');
        }
      } else {
        notify('端末内のPWA通知を有効にしました。');
      }
    } else if (permission === 'denied') {
      actions.updateSettings({ notificationsEnabled: false, inAppReminders: true });
      notify('ブラウザで通知が拒否されています。代わりにアプリ内でお知らせします。', 'info');
    }
  };

  const syncCloud = async (direction: 'upload' | 'download') => {
    setSyncing(true);
    try {
      const { loadStateFromCloud, saveStateToCloud } = await import('../services/firebase');
      if (direction === 'upload') {
        const at = await saveStateToCloud(state);
        actions.replaceState({ ...state, lastSyncedAt: at });
        notify('クラウドへバックアップしました。');
      } else {
        const cloud = await loadStateFromCloud(state.currentUser.id);
        if (!cloud) throw new Error('クラウドにバックアップがありません。');
        actions.replaceState(mergeAppStates(state, { ...cloud, currentUser: state.currentUser }, 'newest'));
        notify('クラウドと端末の新しい内容を統合しました。');
      }
    } catch (reason) {
      notify(userFacingError(reason, '同期を完了できませんでした。端末内のデータは保持されています。もう一度お試しください。'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const connectCalendar = async () => {
    try {
      await connectGoogleCalendar();
      setGoogleConnected(true);
      const calendars = await fetchGoogleCalendars();
      setGoogleCalendars(calendars);
      if (!state.settings.selectedGoogleCalendarId) {
        actions.updateSettings({ selectedGoogleCalendarId: calendars.find((calendar) => calendar.primary)?.id ?? calendars[0]?.id });
      }
      notify('Googleカレンダーと連携しました。');
    } catch (reason) {
      notify(userFacingError(reason, 'Googleカレンダーと連携できませんでした。設定と接続を確認してください。'), 'error');
    }
  };

  useEffect(() => {
    if (!googleConnected) return;
    void fetchGoogleCalendars()
      .then(setGoogleCalendars)
      .catch(() => undefined);
  }, [googleConnected]);

  const refreshCalendar = async () => {
    try {
      const from = new Date(); from.setMonth(from.getMonth() - 2);
      const to = new Date(); to.setMonth(to.getMonth() + 6);
      actions.setGoogleEvents(await fetchGoogleEvents(
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
        state.settings.selectedGoogleCalendarId || 'primary'
      ));
      notify('Googleカレンダーの予定を更新しました。');
    } catch (reason) {
      notify(userFacingError(reason, '予定を取得できませんでした。Google連携を確認して再試行してください。'), 'error');
    }
  };

  return (
    <div className="screen settings-screen">
      <header className="screen-header"><div><p className="eyebrow">SETTINGS</p><h1>設定</h1><p>今日ノートを、自分に合う続け方へ整えます。</p></div></header>
      {message && <Toast tone={message.tone}>{message.text}</Toast>}

      <div className="settings-layout">
        <nav className="settings-index" aria-label="設定内メニュー">
          {['プロフィール', '表示と週', '通知', 'アプリとして使う', 'カテゴリー', 'ポイント・ご褒美', 'クラウド保存', 'Googleカレンダー', 'データ管理', 'アカウント'].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => document.getElementById(`settings-${label}`)?.scrollIntoView({ block: 'start' })}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <SettingSection id="settings-プロフィール" title="プロフィール" description="アプリ内に表示する名前です。">
            <label className="field"><span>表示名</span><input value={displayNameDraft} maxLength={40} onChange={(event) => setDisplayNameDraft(event.target.value)} onBlur={saveDisplayName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
            {state.currentUser.provider !== 'local' && <button className="button button--ghost" onClick={() => { saveDisplayName(); void import('../services/firebase').then(({ updateFirebaseDisplayName }) => updateFirebaseDisplayName(displayNameDraft.trim())).then(() => notify('認証プロフィールの表示名を更新しました。')).catch(() => notify('表示名を更新できませんでした。再ログイン後にお試しください。', 'error')); }}>ログイン情報にも反映</button>}
            <div className="account-chip"><span>{state.settings.displayName.slice(0, 1) || '空'}</span><div><strong>{state.settings.displayName || 'あなた'}</strong><small>{state.currentUser.provider === 'local' ? 'ローカルモード' : state.currentUser.email}</small></div></div>
          </SettingSection>

          <SettingSection id="settings-表示と週" title="表示と週" description="テーマとカレンダーの基準を変更できます。">
            <div className="form-grid">
              <label className="field"><span>テーマ</span><select value={state.settings.theme} onChange={(event) => actions.updateSettings({ theme: event.target.value as 'light' | 'dark' | 'system' })}><option value="system">端末に合わせる</option><option value="light">ライト</option><option value="dark">ダーク</option></select></label>
              <label className="field"><span>週の開始曜日</span><select value={state.settings.weekStartsOn} onChange={(event) => actions.updateSettings({ weekStartsOn: Number(event.target.value) as 0 | 1 })}><option value={1}>月曜日</option><option value={0}>日曜日</option></select></label>
            </div>
          </SettingSection>

          <SettingSection id="settings-通知" title="通知" description="開始・期限と、夜の未完了タスクをお知らせします。">
            {notificationPermission === 'denied' && <div className="notice notice--warning"><strong>ブラウザで通知が拒否されています</strong><p>ブラウザまたは端末のサイト設定から通知を許可してください。それまではアプリ内リマインダーを表示します。iPhoneではホーム画面へ追加したPWAから許可してください。</p></div>}
            {notificationPermission === 'unsupported' && <div className="notice notice--warning"><strong>この環境では通知を利用できません</strong><p>アプリ内リマインダーが自動的に代替します。</p></div>}
            {notificationPermission === 'default' && <div className="notice"><strong>通知はまだ許可されていません</strong><p>下の「通知を使う」をオンにした操作の直後だけ、ブラウザの許可画面を表示します。</p></div>}
            <label className="switch-row"><span><strong>通知を使う</strong><small>権限確認後、タスク時刻にPWA通知します</small></span><input type="checkbox" checked={state.settings.notificationsEnabled} onChange={(event) => event.target.checked ? void enableNotifications() : actions.updateSettings({ notificationsEnabled: false })} /></label>
            <label className="switch-row"><span><strong>アプリ内リマインダー</strong><small>通知が使えない場合にも画面上でお知らせ</small></span><input type="checkbox" checked={state.settings.inAppReminders} onChange={(event) => actions.updateSettings({ inAppReminders: event.target.checked })} /></label>
            <label className="switch-row"><span><strong>夜の未完了通知</strong><small>今日の未完了タスクがある場合にお知らせ</small></span><input type="checkbox" checked={state.settings.eveningReminder} onChange={(event) => actions.updateSettings({ eveningReminder: event.target.checked })} /></label>
            {state.settings.eveningReminder && <label className="field"><span>通知時刻</span><input type="time" value={state.settings.eveningReminderTime} onChange={(event) => actions.updateSettings({ eveningReminderTime: event.target.value })} /></label>}
            <label className="switch-row"><span><strong>朝の予定通知</strong><small>当日のタスクを朝に確認します</small></span><input type="checkbox" checked={state.settings.morningReminder} onChange={(event) => actions.updateSettings({ morningReminder: event.target.checked })} /></label>
            {state.settings.morningReminder && <label className="field"><span>朝の通知時刻</span><input type="time" value={state.settings.morningReminderTime} onChange={(event) => actions.updateSettings({ morningReminderTime: event.target.value })} /></label>}
            <button className="button button--ghost" disabled={notificationPermission !== 'granted'} onClick={() => void showTestNotification().then(() => notify('テスト通知を送信しました。')).catch((reason) => notify(reason instanceof Error ? reason.message : 'テスト通知を送れませんでした。', 'error'))}>通知をテスト</button>
          </SettingSection>

          <SettingSection id="settings-アプリとして使う" title="アプリとして使う" description="ホーム画面から素早く開き、オフラインでも記録を確認できます。">
            <div className="pwa-overview">
              <img src="/icon-192x192.png" alt="空色のノートとチェックマークの今日ノートアイコン" width="72" height="72" />
              <div>
                <strong>今日ノート</strong>
                <span>{pwaStatus.device === 'ios' ? 'iPhone / iPad' : pwaStatus.device === 'android' ? 'Android' : 'パソコン'}向け案内</span>
              </div>
            </div>
            <div className={`connection-card ${pwaStatus.installed ? 'is-connected' : ''}`}>
              <span>{pwaStatus.standalone ? '✓' : pwaStatus.canPrompt ? '↧' : 'i'}</span>
              <div>
                <strong>{pwaStatus.standalone ? 'インストール済み・アプリとして起動中' : pwaStatus.installed ? 'インストール済み' : pwaStatus.canPrompt ? 'インストールできます' : 'ブラウザで利用中'}</strong>
                <p>{pwaStatus.message}</p>
              </div>
            </div>
            <div className="pwa-capabilities" aria-label="PWA機能の状態">
              <span><b aria-hidden="true">{offlineReady ? '✓' : '—'}</b><strong>オフライン</strong><small>{offlineReady ? '最近の画面と端末データを利用可能' : 'このブラウザでは未対応'}</small></span>
              <span><b aria-hidden="true">{notificationPermission === 'granted' ? '✓' : '—'}</b><strong>通知</strong><small>{notificationPermission === 'granted' ? '許可済み' : notificationPermission === 'unsupported' ? 'このブラウザでは未対応' : notificationPermission === 'denied' ? 'ブラウザで拒否されています' : 'インストール後に許可できます'}</small></span>
            </div>
            <div className="pwa-benefits">
              <strong>アプリとして使うメリット</strong>
              <ul>
                <li>ホーム画面から今日の記録をすぐに開けます</li>
                <li>ブラウザのタブを探さず、広いスタンドアロン画面で使えます</li>
                <li>通信が切れても保存済みデータを確認・編集できます</li>
              </ul>
            </div>
            {!pwaStatus.standalone && pwaStatus.device === 'ios' && (
              <div className="notice">
                <strong>iPhone / iPadでホーム画面へ追加</strong>
                {pwaStatus.browser !== 'safari' && <p><b>最初にこのページをSafariで開いてください。</b></p>}
                <ol>
                  <li>Safariの共有ボタンを押す</li>
                  <li>「ホーム画面に追加」を選択する</li>
                  <li>右上の「追加」を押す</li>
                </ol>
              </div>
            )}
            {!pwaStatus.standalone && pwaStatus.device !== 'ios' && (
              <>
                <button
                  className="button button--primary"
                  disabled={!pwaStatus.canPrompt}
                  onClick={() => void requestPwaInstall().then((result) => notify(
                    result === 'accepted'
                      ? 'インストールしました。ホーム画面から開けます。'
                      : result === 'dismissed'
                        ? '案内を閉じました。必要なときにブラウザメニューから追加できます。'
                        : '現在はボタンからインストールできません。表示されている案内をご確認ください。',
                    'info'
                  ))}
                >
                  この端末にインストール
                </button>
                {!pwaStatus.canPrompt && <p className="field-hint">インストールボタンを利用できない理由：{pwaStatus.message}</p>}
              </>
            )}
            <button
              className="button button--ghost"
              type="button"
              onClick={() => window.dispatchEvent(new Event('kyou-note:show-onboarding'))}
            >
              <Icon name="info" /> 初回ガイドをもう一度見る
            </button>
          </SettingSection>

          <SettingSection id="settings-カテゴリー" title="カテゴリー" description="タスクを自分の生活に合う分類へ整理します。">
            <form className="inline-form" onSubmit={saveCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="カテゴリー名" maxLength={40} /><button className="button button--primary" type="submit">{editingCategory ? '変更' : '追加'}</button>{editingCategory && <button type="button" className="button button--ghost" onClick={() => { setEditingCategory(undefined); setCategoryName(''); }}>取消</button>}</form>
            <div className="category-list">{state.categories.map((category) => <div key={category.id}><i style={{ background: category.color }} /><span>{category.name}</span>{category.isDefault && <small>初期</small>}<button className="icon-button icon-button--small" onClick={() => { setEditingCategory(category); setCategoryName(category.name); }} aria-label={`${category.name}を編集`}><Icon name="edit" /></button><button className="icon-button icon-button--small icon-button--danger" onClick={() => setDeleteCategory(category)} aria-label={`${category.name}を削除`}><Icon name="trash" /></button></div>)}</div>
          </SettingSection>

          <SettingSection id="settings-ポイント・ご褒美" title="ポイント・ご褒美" description="落ち着いた達成の目印。不要なら完全に非表示にできます。">
            <label className="switch-row"><span><strong>ポイント機能を表示</strong><small>タスク5〜15pt、習慣8pt、目標50pt</small></span><input type="checkbox" checked={state.settings.pointsEnabled} onChange={(event) => actions.updateSettings({ pointsEnabled: event.target.checked })} /></label>
            {state.settings.pointsEnabled && <>
              <div className="level-summary"><span>Lv. {level.level}</span><div><strong>{totalPoints} pt · 称号「{titleForLevel(level.level)}」</strong><ProgressBar value={Math.round((level.current / level.next) * 100)} label={`次のレベルまで ${level.next - level.current}pt`} /></div></div>
              <form className="inline-form reward-form" onSubmit={addReward}><input value={rewardTitle} onChange={(event) => setRewardTitle(event.target.value)} placeholder="自分へのご褒美" /><input type="number" min="1" value={rewardCost} onChange={(event) => setRewardCost(Number(event.target.value))} aria-label="必要ポイント" /><button className="button button--primary">登録</button></form>
              <div className="reward-list">{state.rewards.map((reward) => <div key={reward.id} className={reward.redeemed ? 'is-redeemed' : ''}><Icon name="sparkles" /><strong>{reward.title}</strong><small>{reward.cost}pt</small><button className="button button--ghost button--small" disabled={reward.redeemed || totalPoints < reward.cost} onClick={() => actions.redeemReward(reward.id)}>{reward.redeemed ? '交換済み' : '交換する'}</button></div>)}</div>
            </>}
          </SettingSection>

          <SettingSection id="settings-クラウド保存" title="クラウド保存" description="Firebase設定時、ユーザー別の領域へ同期します。">
            <div className={`connection-card ${state.currentUser.provider !== 'local' && cloudSyncStatus !== 'error' ? 'is-connected' : ''}`}><span>{state.currentUser.provider !== 'local' ? cloudSyncStatus === 'error' ? '!' : '✓' : <Icon name="cloud" />}</span><div><strong>{state.currentUser.provider === 'local' ? 'ローカル保存モード' : cloudSyncStatus === 'syncing' ? '同期中' : cloudSyncStatus === 'pending' ? `同期待ち ${pendingSyncCount}件` : cloudSyncStatus === 'error' ? '同期失敗' : 'リアルタイム同期中'}</strong><p>{state.currentUser.provider !== 'local' ? `最終同期: ${state.lastSyncedAt ? new Date(state.lastSyncedAt).toLocaleString('ja-JP') : '未同期'}${cloudSyncError ? ` · ${cloudSyncError}` : ''}` : isFirebaseConfigured ? 'ログインすると端末間で同期できます。' : 'Firebase設定後にクラウド同期を利用できます。'}</p></div></div>
            {state.currentUser.provider === 'local' ? <button className="button button--primary" onClick={() => onNavigate('auth')}>ログイン・新規登録</button> : <div className="button-row"><button className="button button--primary" disabled={syncing} onClick={() => void syncCloud('upload')}>今すぐバックアップ</button><button className="button button--ghost" disabled={syncing} onClick={() => void syncCloud('download')}>クラウドから復元</button></div>}
          </SettingSection>

          <SettingSection id="settings-Googleカレンダー" title="Googleカレンダー" description="予定を読み込み、確認後にタスクを書き出します。">
            {!isGoogleCalendarConfigured && <div className="notice"><strong>Google Calendarは未設定です</strong><p>READMEの手順で `VITE_GOOGLE_CLIENT_ID` を設定すると有効になります。他の機能には影響しません。</p></div>}
            <div className={`connection-card ${googleConnected ? 'is-connected' : ''}`}><span>{googleConnected ? 'G' : '—'}</span><div><strong>{googleConnected ? 'Googleカレンダー連携中' : '未連携'}</strong><p>{googleConnected ? `${state.googleEvents.length}件の予定をアプリに保持しています。` : '予定の読み取り・書き込み権限を確認します。'}</p></div></div>
            {googleConnected ? <>
              <label className="field"><span>表示・登録先カレンダー</span><select value={state.settings.selectedGoogleCalendarId ?? ''} onChange={(event) => actions.updateSettings({ selectedGoogleCalendarId: event.target.value })}><option value="">メインカレンダー</option>{googleCalendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.primary ? '（メイン）' : ''}</option>)}</select></label>
              <p className="field-hint">最終Google同期: {state.lastGoogleSyncAt ? new Date(state.lastGoogleSyncAt).toLocaleString('ja-JP') : '未同期'}</p>
              <div className="button-row"><button className="button button--primary" onClick={() => void refreshCalendar()}>手動同期</button><select aria-label="Googleへ登録するタスク" defaultValue="" onChange={(event) => { const task = state.tasks.find((item) => item.id === event.target.value); if (task) setCalendarTask(task); event.target.value = ''; }}><option value="">タスクをGoogleへ登録…</option>{state.tasks.filter((task) => !task.completed && !task.recurrenceSourceId).map((task) => <option value={task.id} key={task.id}>{task.date} {task.title}</option>)}</select><button className="button button--text button--danger-text" onClick={() => void disconnectGoogleCalendar().then(() => { setGoogleConnected(false); setGoogleCalendars([]); actions.setGoogleEvents([]); })}>連携解除</button></div>
            </> : <button className="button button--primary" disabled={!isGoogleCalendarConfigured} onClick={() => void connectCalendar()}>Googleアカウントと連携</button>}
          </SettingSection>

          <SettingSection id="settings-データ管理" title="データ管理" description="バックアップ用の書き出し・読み込みができます。">
            <div className="button-row"><button className="button button--ghost" onClick={() => download(exportState(state), 'application/json', 'json')}>JSONでエクスポート</button><button className="button button--ghost" onClick={exportCsv}>CSVでエクスポート</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /><button className="button button--ghost" onClick={() => importRef.current?.click()}>JSONをインポート</button></div>
            <button className="button button--danger-outline" onClick={() => setConfirmReset(true)}>ローカルデータをすべて削除</button>
          </SettingSection>

          <SettingSection id="settings-アカウント" title="アカウント" description="ログアウトしてもクラウドデータは残ります。">
            {state.currentUser.provider !== 'local' && <button className="button button--ghost" onClick={() => void import('../services/firebase').then(({ logoutFirebase }) => logoutFirebase()).then(() => { actions.replaceState(createInitialState()); onNavigate('auth'); })}>ログアウト</button>}
            <button className="button button--danger-outline" onClick={() => setConfirmAccountDelete(true)}>{state.currentUser.provider === 'local' ? 'ローカルプロフィールを削除' : 'アカウントとクラウドデータを削除'}</button>
          </SettingSection>
        </div>
      </div>

      <ConfirmDialog open={Boolean(deleteCategory)} title="カテゴリーを削除しますか？" message={`「${deleteCategory?.name ?? ''}」を削除します。該当タスクは未分類になります。`} onClose={() => setDeleteCategory(undefined)} onConfirm={() => { if (deleteCategory) actions.deleteCategory(deleteCategory.id); setDeleteCategory(undefined); }} />
      <ConfirmDialog open={confirmReset} title="すべてのローカルデータを削除しますか？" message="タスク、習慣、目標、振り返り、設定をこの端末から削除します。事前のエクスポートをおすすめします。" confirmLabel="すべて削除" onClose={() => setConfirmReset(false)} onConfirm={() => { clearState(); actions.replaceState(createInitialState()); setConfirmReset(false); notify('ローカルデータを削除しました。', 'info'); }} />
      <ConfirmDialog open={confirmAccountDelete} title="アカウントを削除しますか？" message={state.currentUser.provider === 'local' ? 'この端末内の全データを削除します。' : '認証アカウント、画像、クラウドデータを完全に削除します。この操作は元に戻せません。セキュリティ保護により、直近のログインから時間が経っている場合は再ログインが必要です。'} confirmLabel="完全に削除" onClose={() => setConfirmAccountDelete(false)} onConfirm={() => void (async () => { try { if (state.currentUser.provider !== 'local') { const { deleteFirebaseAccount } = await import('../services/firebase'); await deleteFirebaseAccount(); } clearState(); actions.replaceState(createInitialState()); setConfirmAccountDelete(false); onNavigate('auth'); } catch (reason) { const needsLogin = typeof reason === 'object' && reason !== null && 'code' in reason && String((reason as { code?: string }).code).includes('requires-recent-login'); notify(needsLogin ? '安全のため再認証が必要です。一度ログアウトして再ログイン後、もう一度削除してください。' : 'アカウントを削除できませんでした。接続を確認して再試行してください。', 'error'); setConfirmAccountDelete(false); } })()} />
      <Dialog open={Boolean(calendarTask)} title="Googleカレンダーへ登録" onClose={() => setCalendarTask(undefined)}>
        {calendarTask && <div className="form-stack"><div className="event-confirm"><span>タイトル</span><strong>{calendarTask.title}</strong><span>日付</span><strong>{calendarTask.date}</strong><span>開始時刻</span><strong>{calendarTask.startTime || '終日'}</strong><span>終了時刻</span><strong>{calendarTask.deadline || (calendarTask.durationMinutes ? `開始から${calendarTask.durationMinutes}分後` : '終日')}</strong><span>登録先</span><strong>{googleCalendars.find((calendar) => calendar.id === state.settings.selectedGoogleCalendarId)?.name ?? 'メインカレンダー'}</strong><span>説明</span><p>{calendarTask.notes || 'なし'}</p></div><p className="field-hint">同じタスクIDの予定がある場合は重複登録しません。以後のタスク編集は対応するGoogle予定にも反映します。</p><div className="dialog__actions"><button className="button button--ghost" onClick={() => setCalendarTask(undefined)}>キャンセル</button><button className="button button--primary" onClick={() => void createGoogleEvent(calendarTask, state.settings.selectedGoogleCalendarId || 'primary').then((eventId) => { actions.upsertTask({ ...calendarTask, googleEventId: eventId, googleCalendarId: state.settings.selectedGoogleCalendarId || 'primary', updatedAt: new Date().toISOString() }); setCalendarTask(undefined); notify('Googleカレンダーへ登録しました。'); }).catch((reason) => notify(reason instanceof Error ? reason.message : '登録できませんでした。', 'error'))}>この内容で登録</button></div></div>}
      </Dialog>
      <Dialog open={Boolean(pendingImport)} title="インポート内容を確認" onClose={() => setPendingImport(undefined)}>
        {pendingImport && <div className="form-stack"><p>読み込むデータは <strong>{countUserData(pendingImport)}件</strong>、現在のデータは <strong>{countUserData(state)}件</strong> です。</p><div className="notice"><strong>既存データの保護</strong><p>「統合」では同じIDの新しい内容を採用します。「置き換え」は現在の内容をバックアップしてから実行します。</p></div><div className="dialog__actions"><button className="button button--ghost" onClick={() => setPendingImport(undefined)}>キャンセル</button><button className="button button--ghost" onClick={() => { actions.replaceState(mergeAppStates(state, pendingImport, 'newest')); setPendingImport(undefined); notify('データを重複なく統合しました。'); }}>既存データと統合</button><button className="button button--primary" onClick={() => { download(exportState(state), 'application/json', 'json'); actions.replaceState({ ...pendingImport, currentUser: state.currentUser }); setPendingImport(undefined); notify('バックアップ後にデータを置き換えました。'); }}>バックアップして置き換え</button></div></div>}
      </Dialog>
    </div>
  );
}

function SettingSection({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="settings-section" id={id}><header><h2>{title}</h2><p>{description}</p></header><div className="settings-section__body">{children}</div></section>;
}
