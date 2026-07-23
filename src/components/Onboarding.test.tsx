import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

describe('初回ガイド', () => {
  it('短い3ステップを進み、いつでも完了できる', async () => {
    const user = userEvent.setup();
    const finish = vi.fn();
    render(<Onboarding open showSampleNotice onFinish={finish} />);
    expect(screen.getByText(/操作を試すためのサンプル/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '次へ' }));
    expect(screen.getByRole('heading', { name: '記録はこの端末へ自動保存' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '次へ' }));
    await user.click(screen.getByRole('button', { name: '今日ノートを始める' }));
    expect(finish).toHaveBeenCalledOnce();
  });
});
