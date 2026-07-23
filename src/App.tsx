import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { Habit, ISODate, Screen, Task } from './types';
import { useApp } from './state/AppContext';
import { todayISO } from './lib/date';
import { levelForPoints, pointsTotal, tasksForDate, titleForLevel } from './lib/stats';
import {
  dueHabitReminders,
  dueReminders,
  markHabitRemindersShown,
  markRemindersShown,
  showDailySummaryNotification,
  showHabitNotification,
  showTaskNotification
} from './services/notifications';
import './services/pwa';
import { TodayScreen } from './screens/TodayScreen';
import { Icon, Toast } from './components/ui';
import { Onboarding } from './components/Onboarding';
import { hasSavedState } from './data/storage';

const CalendarScreen = lazy(() => import('./screens/CalendarScreen').then((module) => ({ default: module.CalendarScreen })));
const TasksScreen = lazy(() => import('./screens/TasksScreen').then((module) => ({ default: module.TasksScreen })));
const HabitsScreen = lazy(() => import('./screens/HabitsScreen').then((module) => ({ default: module.HabitsScreen })));
const GoalsScreen = lazy(() => import('./screens/GoalsScreen').then((module) => ({ default: module.GoalsScreen })));
const ReflectionScreen = lazy(() => import('./screens/ReflectionScreen').then((module) => ({ default: module.ReflectionScreen })));
const ReportsScreen = lazy(() => import('./screens/ReportsScreen').then((module) => ({ default: module.ReportsScreen })));
const SearchScreen = lazy(() => import('./screens/SearchScreen').then((module) => ({ default: module.SearchScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })));
const AuthScreen = lazy(() => import('./screens/AuthScreen').then((module) => ({ default: module.AuthScreen })));

const screens: { id: Screen; label: string; icon: string; primary?: boolean }[] = [
  { id: 'today', label: '今日', icon: 'today', primary: true },
  { id: 'calendar', label: 'カレンダー', icon: 'calendar', primary: true },
  { id: 'tasks', label: 'タスク', icon: 'tasks', primary: true },
  { id: 'habits', label: '習慣', icon: 'habits', primary: true },
  { id: 'goals', label: '目標', icon: 'goals', primary: true },
  { id: 'reflection', label: '振り返り', icon: 'reflection' },
  { id: 'reports', label: 'レポート', icon: 'reports' },
  { id: 'search', label: '検索', icon: 'search' },
  { id: 'settings', label: '設定', icon: 'settings' }
];
const sidebarGroups = [
  { label: '毎日の記録', ids: ['today', 'calendar', 'tasks', 'habits', 'goals'] as Screen[] },
  { label: '振り返り・管理', ids: ['reflection', 'reports', 'search', 'settings'] as Screen[] }
];
const ONBOARDING_KEY = 'kyou-note:onboarding:v1';

const shouldShowOnboarding = () => {
  try {
    return !hasSavedState() && localStorage.getItem(ONBOARDING_KEY) !== 'done';
  } catch {
    return false;
  }
};

const screenFromHash = (): Screen => {
  const value = window.location.hash.slice(1) as Screen;
  return screens.some((screen) => screen.id === value) || value === 'auth' ? value : 'today';
};

const readSessionKeys = (key: string): Set<string> => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(-100) : []);
  } catch {
    return new Set();
  }
};

export default function App() {
  const {
    state,
    actions,
    saveStatus,
    saveError,
    cloudSyncStatus,
    cloudSyncError,
    pendingSyncCount,
    authStatus,
    undoNotice
  } = useApp();
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO());
  const [mobileMenu, setMobileMenu] = useState(false);
  const [reminders, setReminders] = useState<Task[]>([]);
  const [habitReminders, setHabitReminders] = useState<Habit[]>([]);
  const [dailyReminder, setDailyReminder] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [pwaError, setPwaError] = useState('');
  const [onboardingOpen, setOnboardingOpen] = useState(shouldShowOnboarding);
  const reminderStateRef = useRef(state);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const mobileMenuPreviousFocus = useRef<HTMLElement | null>(null);
  const swUpdateTimer = useRef<number | undefined>(undefined);
  reminderStateRef.current = state;
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        window.clearInterval(swUpdateTimer.current);
        swUpdateTimer.current = window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError() {
      setPwaError('オフライン機能を準備できませんでした。オンライン接続で再読み込みしてください。');
    }
  });

  useEffect(() => () => window.clearInterval(swUpdateTimer.current), []);

  const navigate = (next: Screen, replace = false) => {
    setScreen(next);
    setMobileMenu(false);
    if (window.location.hash !== `#${next}`) {
      if (replace) window.history.replaceState(null, '', `#${next}`);
      else window.history.pushState(null, '', `#${next}`);
    }
    document.getElementById('main-content')?.focus();
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    const show = () => setOnboardingOpen(true);
    window.addEventListener('kyou-note:show-onboarding', show);
    return () => window.removeEventListener('kyou-note:show-onboarding', show);
  }, []);

  useEffect(() => {
    const onHistoryChange = () => setScreen(screenFromHash());
    window.addEventListener('popstate', onHistoryChange);
    window.addEventListener('hashchange', onHistoryChange);
    return () => {
      window.removeEventListener('popstate', onHistoryChange);
      window.removeEventListener('hashchange', onHistoryChange);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenu) return;
    mobileMenuPreviousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menu = mobileMenuRef.current;
    const focusable = () => [...(menu?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenu(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      mobileMenuPreviousFocus.current?.focus();
    };
  }, [mobileMenu]);

  useEffect(() => {
    const handleOffline = () => setOnline(false);
    const handleOnline = () => {
      setOnline(true);
      if (state.currentUser.provider !== 'local') actions.retryCloudSync();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [actions, state.currentUser.provider]);

  useEffect(() => {
    if (authStatus === 'unauthenticated' && state.currentUser.provider !== 'local' && screen !== 'auth') {
      navigate('auth', true);
    }
  }, [authStatus, screen, state.currentUser.provider]);

  useEffect(() => {
    const check = () => {
      const current = reminderStateRef.current;
      const due = dueReminders(current);
      if (due.length && current.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        due.forEach((task) => void showTaskNotification(task));
      }
      if (due.length && current.settings.inAppReminders) {
        setReminders((items) => [...items, ...due.filter((task) => !items.some((item) => item.id === task.id))]);
      }
      if (due.length) markRemindersShown(due);
      const dueHabits = dueHabitReminders(current);
      if (dueHabits.length) {
        if (current.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          dueHabits.forEach((habit) => void showHabitNotification(habit));
        }
        if (current.settings.inAppReminders) {
          setHabitReminders((items) => [...items, ...dueHabits.filter((habit) => !items.some((item) => item.id === habit.id))]);
        }
        markHabitRemindersShown(dueHabits);
      }
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dailyKeys = readSessionKeys('kyou-note:daily-notifications');
      const todayTasks = tasksForDate(current.tasks, todayISO());
      const morningKey = `morning:${todayISO()}`;
      if (current.settings.morningReminder && currentTime === current.settings.morningReminderTime && !dailyKeys.has(morningKey)) {
        void showDailySummaryNotification('おはようございます', `今日のタスクは${todayTasks.length}件です。`, morningKey);
        if (current.settings.inAppReminders) setDailyReminder(`おはようございます。今日のタスクは${todayTasks.length}件です。`);
        dailyKeys.add(morningKey);
      }
      const eveningKey = `evening:${todayISO()}`;
      const openCount = todayTasks.filter((task) => !task.completed).length;
      if (current.settings.eveningReminder && currentTime === current.settings.eveningReminderTime && openCount > 0 && !dailyKeys.has(eveningKey)) {
        void showDailySummaryNotification('今日の未完了タスク', `未完了が${openCount}件あります。明日の予定も確認しましょう。`, eveningKey);
        if (current.settings.inAppReminders) setDailyReminder(`今日の未完了タスクが${openCount}件あります。`);
        dailyKeys.add(eveningKey);
      }
      try {
        sessionStorage.setItem('kyou-note:daily-notifications', JSON.stringify([...dailyKeys].slice(-100)));
      } catch {
        // 一時履歴の保存に失敗しても画面は継続します。
      }
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const eveningReminder = useMemo(() => {
    if (!state.settings.eveningReminder || !state.settings.inAppReminders) return false;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return current >= state.settings.eveningReminderTime && tasksForDate(state.tasks, todayISO()).some((task) => !task.completed);
  }, [state.settings.eveningReminder, state.settings.eveningReminderTime, state.settings.inAppReminders, state.tasks]);

  if (screen === 'auth') return <Suspense fallback={<ScreenLoader />}><AuthScreen onNavigate={navigate} /></Suspense>;
  if (state.currentUser.provider !== 'local' && authStatus === 'loading') return <ScreenLoader />;

  const points = pointsTotal(state);
  const level = levelForPoints(points);
  const activeScreen = screens.find((item) => item.id === screen);

  const renderScreen = () => {
    switch (screen) {
      case 'today':
        return <TodayScreen selectedDate={selectedDate} onDateChange={setSelectedDate} onNavigate={navigate} />;
      case 'calendar':
        return <CalendarScreen selectedDate={selectedDate} onDateChange={setSelectedDate} onNavigate={navigate} />;
      case 'tasks':
        return <TasksScreen selectedDate={selectedDate} />;
      case 'habits':
        return <HabitsScreen selectedDate={selectedDate} />;
      case 'goals':
        return <GoalsScreen />;
      case 'reflection':
        return <ReflectionScreen selectedDate={selectedDate} onDateChange={setSelectedDate} />;
      case 'reports':
        return <ReportsScreen />;
      case 'search':
        return <SearchScreen onNavigate={navigate} onDateChange={setSelectedDate} />;
      case 'settings':
        return <SettingsScreen onNavigate={navigate} />;
      default:
        return <TodayScreen selectedDate={selectedDate} onDateChange={setSelectedDate} onNavigate={navigate} />;
    }
  };

  const finishOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'done');
    } catch {
      // 保存できない環境でもガイドを閉じて利用を継続します。
    }
    setOnboardingOpen(false);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('today')} aria-label="今日ノートのホームへ">
          <img src="/icon-192x192.png" alt="" />
          <div><strong>今日ノート</strong><span>Calm Sky</span></div>
        </button>
        <nav className="sidebar-nav" aria-label="メインナビゲーション">
          {sidebarGroups.map((group) => (
            <div className="sidebar-nav__group" key={group.label}>
              <span>{group.label}</span>
              {screens.filter((item) => group.ids.includes(item.id)).map((item) => (
                <button key={item.id} className={screen === item.id ? 'is-active' : ''} aria-current={screen === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
                  <Icon name={item.icon} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className={`desktop-save-status save-indicator--${state.currentUser.provider === 'local' ? saveStatus : cloudSyncStatus}`} role="status">
            <span aria-hidden="true">{saveStatus === 'error' || cloudSyncStatus === 'error' ? '!' : cloudSyncStatus === 'syncing' || saveStatus === 'saving' ? '↻' : '✓'}</span>
            {state.currentUser.provider === 'local'
              ? saveStatus === 'saving' ? '端末へ保存中' : saveStatus === 'error' ? '保存できません' : '端末に保存済み'
              : cloudSyncStatus === 'syncing' ? 'クラウド同期中' : cloudSyncStatus === 'pending' ? `同期待ち ${pendingSyncCount}件` : cloudSyncStatus === 'error' ? '同期できません' : 'クラウド同期済み'}
          </div>
          {state.settings.pointsEnabled && <div className="level-pill" title={`称号: ${titleForLevel(level.level)}`}><span>Lv. {level.level}</span><div><strong>{points} pt</strong><small>{titleForLevel(level.level)}</small><i><b style={{ width: `${(level.current / level.next) * 100}%` }} /></i></div></div>}
          <button className="profile-button" onClick={() => navigate('settings')}><span>{state.settings.displayName.slice(0, 1) || '空'}</span><div><strong>{state.settings.displayName || 'あなた'}</strong><small>{state.currentUser.provider === 'local' ? 'ローカル保存' : 'クラウド同期'}</small></div><Icon name="chevronRight" /></button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <button className="brand" onClick={() => navigate('today')}><img src="/icon-192x192.png" alt="" /><div><strong>今日ノート</strong></div></button>
          <span className={`save-indicator save-indicator--${cloudSyncStatus}`}>
            {state.currentUser.provider === 'local'
              ? saveStatus === 'saving' ? '保存中…' : saveStatus === 'error' ? '保存失敗' : '端末に保存済み'
              : cloudSyncStatus === 'syncing' ? '同期中…'
                : cloudSyncStatus === 'pending' ? `同期待ち ${pendingSyncCount}`
                  : cloudSyncStatus === 'error' ? '同期失敗'
                    : '同期済み'}
          </span>
          <button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="メニューを開く"><Icon name="menu" /></button>
        </header>

        {needRefresh && <div className="update-banner" role="status"><span>新しいバージョンを利用できます。</span><button className="button button--primary button--small" onClick={() => void updateServiceWorker(true)}>今すぐ更新</button><button className="icon-button icon-button--small" onClick={() => setNeedRefresh(false)} aria-label="閉じる"><Icon name="close" /></button></div>}
        {pwaError && <div className="sync-error-banner" role="alert"><span>{pwaError}</span><button className="button button--small button--ghost" onClick={() => window.location.reload()}>再試行</button><button className="icon-button icon-button--small" onClick={() => setPwaError('')} aria-label="閉じる"><Icon name="close" /></button></div>}
        {!online && <div className="offline-banner" role="status"><span>オフラインです。変更はこの端末へ保存し、再接続時に同期します。</span></div>}
        {saveStatus === 'error' && <div className="sync-error-banner" role="alert"><span>{saveError ?? '端末へ保存できませんでした。'}</span></div>}
        {online && cloudSyncError && <div className="sync-error-banner" role="alert"><span>{cloudSyncError}</span><button className="button button--small button--ghost" onClick={() => actions.retryCloudSync()}>再試行</button></div>}
        {eveningReminder && screen === 'today' && <div className="evening-banner"><Icon name="moon" /><p>今日の未完了タスクがあります。明日に移すか、できたところまで記録しておきましょう。</p></div>}
        {reminders.map((task) => <div key={task.id} className="floating-toast"><Toast tone="info"><strong>{task.title}</strong><span>タスクの時間です</span><button onClick={() => setReminders((items) => items.filter((item) => item.id !== task.id))}>閉じる</button></Toast></div>)}
        {habitReminders.map((habit) => <div key={habit.id} className="floating-toast floating-toast--habit"><Toast tone="info"><strong>{habit.name}</strong><span>習慣を記録する時間です</span><button onClick={() => setHabitReminders((items) => items.filter((item) => item.id !== habit.id))}>閉じる</button></Toast></div>)}
        {dailyReminder && <div className="floating-toast floating-toast--daily"><Toast tone="info"><strong>今日ノート</strong><span>{dailyReminder}</span><button onClick={() => setDailyReminder('')}>閉じる</button></Toast></div>}
        {undoNotice && (
          <div className="undo-toast">
            <Toast tone="info">
              <span>{undoNotice.label}</span>
              <button onClick={() => actions.undoLastDelete()}>元に戻す</button>
            </Toast>
          </div>
        )}

        <main id="main-content" tabIndex={-1}><Suspense fallback={<ScreenLoader />}>{renderScreen()}</Suspense></main>
      </div>

      <nav className="bottom-nav" aria-label="モバイルナビゲーション">
        {screens.filter((item) => item.primary).map((item) => (
          <button key={item.id} className={screen === item.id ? 'is-active' : ''} aria-current={screen === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>
        ))}
        <button className={!activeScreen?.primary ? 'is-active' : ''} onClick={() => setMobileMenu(true)}><Icon name="menu" /><span>メニュー</span></button>
      </nav>

      {mobileMenu && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenu(false)}>
          <aside ref={mobileMenuRef} className="mobile-menu" onClick={(event) => event.stopPropagation()} aria-label="その他のメニュー" role="dialog" aria-modal="true">
            <header><h2>メニュー</h2><button className="icon-button" onClick={() => setMobileMenu(false)} aria-label="閉じる"><Icon name="close" /></button></header>
            {screens.map((item) => <button key={item.id} className={screen === item.id ? 'is-active' : ''} onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span><Icon name="chevronRight" /></button>)}
            <button onClick={() => navigate('auth')}><Icon name="cloud" /><span>{state.currentUser.provider === 'local' ? 'ログイン・新規登録' : state.currentUser.email}</span><Icon name="chevronRight" /></button>
          </aside>
        </div>
      )}
      <Onboarding
        open={onboardingOpen}
        showSampleNotice={!hasSavedState()}
        onFinish={finishOnboarding}
      />
    </div>
  );
}

function ScreenLoader() {
  return (
    <div className="screen screen-skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">画面を読み込んでいます…</span>
      <div className="skeleton skeleton--title" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
      <div className="skeleton skeleton--panel" />
    </div>
  );
}
