import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppProvider, createEntityBase } from '../state/AppContext';
import { createInitialState } from '../data/seed';
import { saveState } from '../data/storage';
import { AttachmentPicker } from './AttachmentPicker';

describe('画像添付', () => {
  it('対応していない形式を処理前に拒否する', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(
      <AppProvider>
        <AttachmentPicker ownerType="task" ownerId="task" attachmentIds={[]} onChange={() => undefined} />
      </AppProvider>
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(['text'], 'unsafe.svg', { type: 'image/svg+xml' }));
    expect(screen.getByRole('alert')).toHaveTextContent('JPEG・PNG・WebP・GIF画像を選択してください。');
  });

  it('保存済み画像の名前を示してから削除する', async () => {
    const state = createInitialState();
    state.attachments = [{
      ...createEntityBase(state.currentUser.id),
      ownerType: 'task',
      ownerId: 'task',
      name: '進捗写真.png',
      mimeType: 'image/png',
      size: 10,
      dataUrl: 'data:image/png;base64,iVBORw0KGgo='
    }];
    saveState(state);
    const user = userEvent.setup();
    render(
      <AppProvider>
        <AttachmentPicker
          ownerType="task"
          ownerId="task"
          attachmentIds={[state.attachments[0].id]}
          onChange={() => undefined}
        />
      </AppProvider>
    );
    await user.click(screen.getByRole('button', { name: '進捗写真.pngを削除' }));
    expect(screen.getByText('画像「進捗写真.png」を削除します。この操作は元に戻せません。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(screen.queryByAltText('進捗写真.png')).not.toBeInTheDocument();
  });
});
