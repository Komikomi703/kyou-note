export function userFacingError(error: unknown, fallback: string): string {
  const source = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  if (/network|unavailable|offline|failed to fetch/i.test(source)) {
    return '通信できませんでした。接続を確認して、もう一度お試しください。端末内のデータは保持されています。';
  }
  if (/permission-denied|unauthorized|forbidden/i.test(source)) {
    return 'この操作を行う権限を確認できませんでした。再ログインしてからお試しください。';
  }
  if (/quota|resource-exhausted/i.test(source)) {
    return '保存容量または利用上限に達しました。不要な画像を整理してからお試しください。';
  }
  if (/requires-recent-login/i.test(source)) {
    return '安全のため再認証が必要です。一度ログアウトして再ログイン後、もう一度お試しください。';
  }
  if (/too-many-requests/i.test(source)) {
    return '短時間に操作が集中しました。しばらく待ってからお試しください。';
  }
  return fallback;
}
