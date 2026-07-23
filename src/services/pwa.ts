interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaInstallStatus {
  standalone: boolean;
  installed: boolean;
  canPrompt: boolean;
  device: 'ios' | 'android' | 'desktop';
  browser: 'safari' | 'chromium' | 'other';
  secureContext: boolean;
  dismissed: boolean;
  message: string;
}

let installPrompt: InstallPromptEvent | undefined;
const listeners = new Set<() => void>();
const installedKey = 'kyou-note:pwa-installed';
const dismissedKey = 'kyou-note:pwa-install-dismissed';
const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLocal = (key: string, value?: string) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ブラウザが端末保存を制限していてもインストール判定は継続します。
  }
};

const notify = () => listeners.forEach((listener) => listener());

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  writeLocal(dismissedKey);
  notify();
});

window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  writeLocal(installedKey, 'true');
  writeLocal(dismissedKey);
  notify();
});

export const isStandalone = (): boolean =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

export const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isIOSSafari = (): boolean =>
  isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

export const isAndroid = (): boolean => /android/i.test(navigator.userAgent);

export const canPromptInstall = (): boolean => Boolean(installPrompt);

export const getPwaInstallStatus = (): PwaInstallStatus => {
  const standalone = isStandalone();
  const installed = standalone || readLocal(installedKey) === 'true';
  const dismissed = Boolean(readLocal(dismissedKey));
  const secureContext = window.isSecureContext ||
    ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const device = isIOS() ? 'ios' : isAndroid() ? 'android' : 'desktop';
  const browser = isIOSSafari()
    ? 'safari'
    : /chrome|crios|edg|android/i.test(navigator.userAgent)
      ? 'chromium'
      : 'other';

  let message: string;
  if (standalone) {
    message = 'ホーム画面からスタンドアロンで起動しています。';
  } else if (!secureContext) {
    message = 'インストールにはHTTPS接続が必要です。localhostでは開発確認できます。';
  } else if (device === 'ios' && !isIOSSafari()) {
    message = 'iPhone・iPadではSafariで開いてから「ホーム画面に追加」を使用してください。';
  } else if (device === 'ios') {
    message = 'Safariの共有メニューからホーム画面へ追加できます。';
  } else if (installPrompt) {
    message = 'この端末へ今日ノートをインストールできます。';
  } else if (dismissed) {
    message = '前回の案内を閉じました。ブラウザメニューからいつでもインストールできます。';
  } else if (!('serviceWorker' in navigator)) {
    message = 'このブラウザはオフラインアプリ機能に対応していません。';
  } else {
    message = installed
      ? 'この端末にはインストール済みです。ブラウザ表示中の可能性があります。'
      : 'ブラウザがインストール条件を確認中です。メニューの「アプリをインストール」も確認してください。';
  }

  return {
    standalone,
    installed,
    canPrompt: Boolean(installPrompt),
    device,
    browser,
    secureContext,
    dismissed,
    message
  };
};

export const requestPwaInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
  if (!installPrompt) return 'unavailable';
  await installPrompt.prompt();
  const result = await installPrompt.userChoice;
  if (result.outcome === 'accepted') {
    installPrompt = undefined;
    writeLocal(installedKey, 'true');
    writeLocal(dismissedKey);
  } else {
    writeLocal(dismissedKey, new Date().toISOString());
  }
  notify();
  return result.outcome;
};

export const subscribeInstallStatus = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
