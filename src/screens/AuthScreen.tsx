import { useState, type FormEvent } from 'react';
import type { Screen, UserProfile } from '../types';
import { useApp } from '../state/AppContext';
import { createInitialState } from '../data/seed';
import { exportState } from '../data/storage';
import { countUserData, mergeAppStates, reassignStateUser } from '../data/sync';
import {
  loadStateFromCloud,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  saveStateToCloud,
  sendResetEmail
} from '../services/firebase';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import { Dialog, Icon } from '../components/ui';

type AuthMode = 'login' | 'register' | 'reset';

const firebaseMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('invalid-credential')) return 'メールアドレスまたはパスワードが正しくありません。';
  if (message.includes('email-already-in-use')) return 'このメールアドレスは登録済みです。';
  if (message.includes('weak-password')) return 'パスワードは6文字以上にしてください。';
  if (message.includes('network')) return 'ネットワークに接続できません。ローカルモードは引き続き利用できます。';
  if (message.includes('too-many-requests')) return '試行回数が多すぎます。しばらく待ってからお試しください。';
  if (message.includes('popup-closed')) return 'Googleログインをキャンセルしました。';
  return '認証処理を完了できませんでした。入力内容と接続を確認して、もう一度お試しください。';
};

export function AuthScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { state, actions } = useApp();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingMigration, setPendingMigration] = useState<{
    profile: UserProfile;
    cloud?: typeof state;
  }>();

  const prepareLogin = async (profile: UserProfile) => {
    const cloud = await loadStateFromCloud(profile.id);
    if (countUserData(state) > 0 || (cloud && countUserData(cloud) > 0)) {
      setPendingMigration({ profile, cloud });
      return;
    }
    await finishMigration(profile, cloud, 'local');
  };

  const finishMigration = async (
    profile: UserProfile,
    cloud: typeof state | undefined,
    strategy: 'merge' | 'cloud' | 'local' | 'skip'
  ) => {
    const local = reassignStateUser(state, profile.id);
    const empty = reassignStateUser(createInitialState(), profile.id);
    const cloudState = cloud ? { ...cloud, currentUser: profile } : { ...empty, currentUser: profile };
    let next = strategy === 'merge'
      ? mergeAppStates(local, cloudState, 'newest')
      : strategy === 'cloud' || strategy === 'skip'
        ? cloudState
        : local;
    next = {
      ...next,
      currentUser: profile,
      settings: { ...next.settings, displayName: profile.displayName },
      migrationHistory: [
        ...(next.migrationHistory ?? []),
        {
          id: crypto.randomUUID(),
          userId: profile.id,
          strategy,
          migratedAt: new Date().toISOString(),
          localItemCount: countUserData(state),
          cloudItemCount: cloud ? countUserData(cloud) : 0
        }
      ]
    };
    try {
      sessionStorage.setItem('kyou-note:pre-migration-backup', exportState(state));
    } catch {
      // 大きな画像を含む場合は画面からファイルとして保存できます。
    }
    if (strategy !== 'skip' || !cloud) await saveStateToCloud(next);
    actions.replaceState(next);
    setPendingMigration(undefined);
    onNavigate('today');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!isFirebaseConfigured) return setError('Firebaseが未設定です。ローカルモードをご利用ください。');
    if (!email.trim()) return setError('メールアドレスを入力してください。');
    if (mode !== 'reset' && password.length < 6) return setError('パスワードは6文字以上にしてください。');
    if (mode === 'register' && !name.trim()) return setError('表示名を入力してください。');
    setLoading(true);
    try {
      if (mode === 'reset') {
        await sendResetEmail(email.trim());
        setMessage('パスワード再設定メールを送信しました。');
      } else {
        const profile = mode === 'register'
          ? await registerWithEmail(email.trim(), password, name.trim())
          : await loginWithEmail(email.trim(), password);
        await prepareLogin(profile);
      }
    } catch (reason) {
      setError(firebaseMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await prepareLogin(await loginWithGoogle());
    } catch (reason) {
      setError(firebaseMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const useLocal = () => {
    if (state.currentUser.provider !== 'local') actions.replaceState(createInitialState());
    onNavigate('today');
  };

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <div className="brand brand--large"><img src="/icon-192x192.png" alt="" /><div><strong>今日ノート</strong><span>Calm Sky</span></div></div>
        <div><span className="auth-intro__cloud" aria-hidden="true"><Icon name="cloud" /></span><h1>今日を整え、<br />明日へつなぐ。</h1><p>タスク、習慣、目標、振り返りをひとつの穏やかな場所に。</p></div>
        <ul><li><Icon name="check" /> オフラインでも使える</li><li><Icon name="check" /> 端末間で安全に同期</li><li><Icon name="check" /> あなたのデータは他のユーザーから分離</li></ul>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit} aria-busy={loading}>
          <header><p className="eyebrow">{mode === 'register' ? 'CREATE ACCOUNT' : mode === 'reset' ? 'RESET PASSWORD' : 'WELCOME BACK'}</p><h2>{mode === 'register' ? '新規登録' : mode === 'reset' ? 'パスワード再設定' : 'ログイン'}</h2><p>{isFirebaseConfigured ? 'クラウド保存で、どの端末からでも続きから。' : '現在はFirebase未設定です。ローカルモードで全機能を試せます。'}</p></header>
          {mode === 'register' && <label className="field"><span>表示名 <b aria-hidden="true">*</b></span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={40} placeholder="例：空野あおい" /></label>}
          <label className="field"><span>メールアドレス <b aria-hidden="true">*</b></span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" aria-describedby={error ? 'auth-error' : undefined} /></label>
          {mode !== 'reset' && <label className="field"><span>パスワード <b aria-hidden="true">*</b></span><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={6} required aria-describedby={error ? 'auth-error' : undefined} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}>{showPassword ? '隠す' : '表示'}</button></div></label>}
          {error && <p id="auth-error" className="auth-message auth-message--error" role="alert">{error}</p>}
          {message && <p className="auth-message auth-message--success" role="status">{message}</p>}
          <button className="button button--primary button--full" type="submit" disabled={loading || !isFirebaseConfigured}>{loading ? '処理中…' : mode === 'register' ? 'アカウントを作成' : mode === 'reset' ? '再設定メールを送る' : 'ログイン'}</button>
          {mode !== 'reset' && <>
            <div className="auth-divider"><span>または</span></div>
            <button className="button button--google button--full" type="button" disabled={loading || !isFirebaseConfigured} onClick={() => void googleLogin()}><b>G</b> Googleで続ける</button>
          </>}
          <button className="button button--local button--full" type="button" onClick={useLocal}>ログインせずローカルで使う</button>
          <footer>
            {mode === 'login' && <><button type="button" onClick={() => setMode('reset')}>パスワードを忘れた方</button><span>・</span><button type="button" onClick={() => setMode('register')}>新規登録</button></>}
            {mode !== 'login' && <button type="button" onClick={() => setMode('login')}>ログインへ戻る</button>}
          </footer>
        </form>
      </section>
      <Dialog open={Boolean(pendingMigration)} title="データの移行方法を選択" onClose={() => undefined} wide>
        {pendingMigration && (
          <div className="form-stack migration-dialog">
            <p>自動では上書きしません。ローカルとクラウドの件数を確認し、今回の扱いを選んでください。</p>
            <div className="migration-counts">
              <div><span>この端末</span><strong>{countUserData(state)}件</strong></div>
              <div><span>クラウド</span><strong>{pendingMigration.cloud ? countUserData(pendingMigration.cloud) : 0}件</strong></div>
            </div>
            <div className="notice">
              <strong>重複について</strong>
              <p>同じIDは1件にまとめ、更新日時が新しい内容を採用します。削除履歴がある項目は復活させません。</p>
            </div>
            <button
              className="button button--ghost"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([exportState(state)], { type: 'application/json' }));
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `kyou-note-before-migration-${new Date().toISOString().slice(0, 10)}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              移行前バックアップを保存
            </button>
            <div className="migration-options">
              <button className="button button--primary" onClick={() => void finishMigration(pendingMigration.profile, pendingMigration.cloud, 'merge')}>ローカルデータをクラウドへ追加</button>
              <button className="button button--ghost" onClick={() => void finishMigration(pendingMigration.profile, pendingMigration.cloud, 'cloud')}>クラウドデータを優先</button>
              <button className="button button--ghost" onClick={() => void finishMigration(pendingMigration.profile, pendingMigration.cloud, 'local')}>ローカルデータを優先</button>
              <button className="button button--text" onClick={() => void finishMigration(pendingMigration.profile, pendingMigration.cloud, 'skip')}>今は移行しない</button>
            </div>
            <p className="field-hint">移行後はログイン中の端末間で同期されます。移行履歴も保存します。</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
