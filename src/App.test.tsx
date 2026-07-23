import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AppProvider } from './state/AppContext';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn()
  })
}));

describe('アプリ全体の基本導線', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#today');
    vi.stubGlobal('scrollTo', vi.fn());
  });

  it('初回案内を閉じて、今日からカレンダーへ移動できる', async () => {
    const user = userEvent.setup();
    render(<AppProvider><App /></AppProvider>);
    expect(screen.getByRole('heading', { name: '今日ノートへようこそ' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(localStorage.getItem('kyou-note:onboarding:v1')).toBe('done');
    await user.click(screen.getAllByRole('button', { name: 'カレンダー' })[0]);
    expect(await screen.findByRole('heading', { name: 'カレンダー' }, { timeout: 5000 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#calendar');
  });
});
