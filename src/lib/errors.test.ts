import { describe, expect, it } from 'vitest';
import { userFacingError } from './errors';

describe('利用者向けエラー', () => {
  it('SDKの英語エラーをそのまま表示しない', () => {
    const message = userFacingError(
      new Error('FirebaseError: Missing or insufficient permissions (permission-denied)'),
      '処理できませんでした。'
    );
    expect(message).toContain('権限');
    expect(message).not.toContain('FirebaseError');
  });

  it('未知の内部エラーには安全な案内を使う', () => {
    expect(userFacingError(new Error('internal stack detail'), 'もう一度お試しください。')).toBe('もう一度お試しください。');
  });
});
