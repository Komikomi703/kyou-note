import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../state/AppContext';
import { TaskForm } from '../components/TaskForm';
import { AuthScreen } from './AuthScreen';
import { SettingsScreen } from './SettingsScreen';
import { TodayScreen } from './TodayScreen';

const expectNoViolations = async (container: HTMLElement) => {
  const result = await axe.run(container, {
    rules: {
      // jsdomは実際の描画色を計算できないため、コントラストはCSSトークンと実機側で確認します。
      'color-contrast': { enabled: false }
    }
  });
  expect(result.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
};

describe('主要画面のアクセシビリティ', () => {
  it('今日画面に自動検出可能な重大違反がない', async () => {
    const { container } = render(
      <AppProvider>
        <TodayScreen selectedDate="2026-07-23" onDateChange={() => undefined} onNavigate={() => undefined} />
      </AppProvider>
    );
    await expectNoViolations(container);
  });

  it('認証画面と設定画面に重大違反がない', async () => {
    const auth = render(<AppProvider><AuthScreen onNavigate={() => undefined} /></AppProvider>);
    await expectNoViolations(auth.container);
    auth.unmount();

    const settings = render(<AppProvider><SettingsScreen onNavigate={() => undefined} /></AppProvider>);
    await expectNoViolations(settings.container);
  });

  it('タスク入力ダイアログに重大違反がない', async () => {
    const { container } = render(
      <AppProvider>
        <TaskForm open initialDate="2026-07-23" onClose={() => undefined} />
      </AppProvider>
    );
    await expectNoViolations(container);
  });
});
