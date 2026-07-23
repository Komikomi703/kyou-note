import { useRef, useState } from 'react';
import type { Attachment } from '../types';
import { createEntityBase, useApp } from '../state/AppContext';
import { ConfirmDialog, Icon } from './ui';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_INPUT_SIZE = 8 * 1024 * 1024;
const MAX_LOCAL_IMAGE_CHARACTERS = 4_200_000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const hasValidSignature = async (file: File): Promise<boolean> => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (file.type === 'image/gif') return String.fromCharCode(...bytes.slice(0, 6)).startsWith('GIF8');
  if (file.type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
};

const checksumFor = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const compressImage = async (file: File): Promise<Blob> => {
  if (file.type === 'image/gif' || file.size <= MAX_FILE_SIZE) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('画像を圧縮できませんでした。')),
      outputType,
      0.82
    )
  );
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    reader.readAsDataURL(blob);
  });

export function AttachmentPicker({
  ownerType,
  ownerId,
  attachmentIds,
  onChange
}: {
  ownerType: Attachment['ownerType'];
  ownerId: string;
  attachmentIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { state, actions } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Attachment>();
  const cancelled = useRef(false);
  const attachments = state.attachments.filter((item) => attachmentIds.includes(item.id));

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('JPEG・PNG・WebP・GIF画像を選択してください。');
      return;
    }
    if (file.size > MAX_INPUT_SIZE) {
      setError('画像は8MB以下にしてください。大きな画像は自動で圧縮します。');
      return;
    }
    setUploading(true);
    setProgress(10);
    cancelled.current = false;
    try {
      if (!(await hasValidSignature(file))) throw new Error('画像の内容とMIMEタイプが一致しません。');
      setProgress(30);
      const compressed = await compressImage(file);
      if (cancelled.current) return;
      if (compressed.size > MAX_FILE_SIZE) throw new Error('圧縮後も2MBを超えています。より小さな画像を選択してください。');
      setProgress(60);
      const checksum = await checksumFor(compressed);
      if (state.attachments.some((attachment) => attachment.checksum === checksum)) {
        throw new Error('同じ画像はすでに追加されています。');
      }
      const dataUrl = await blobToDataUrl(compressed);
      if (cancelled.current) return;
      const localImageCharacters = state.attachments.reduce(
        (total, attachment) => total + (attachment.dataUrl.startsWith('data:') ? attachment.dataUrl.length : 0),
        0
      );
      if (localImageCharacters + dataUrl.length > MAX_LOCAL_IMAGE_CHARACTERS) {
        throw new Error('端末保存の画像容量が上限に近づいています。不要な画像を削除するか、Firebaseへログインして同期してください。');
      }
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage && estimate.usage + dataUrl.length > estimate.quota * 0.9) {
          throw new Error('端末の保存容量が不足しています。空き容量を増やしてから再度お試しください。');
        }
      }
      setProgress(90);
      const attachment: Attachment = {
        ...createEntityBase(state.currentUser.id),
        ownerType,
        ownerId,
        name: file.name,
        mimeType: compressed.type || file.type,
        size: compressed.size,
        dataUrl,
        checksum
      };
      actions.addAttachment(attachment);
      onChange([...attachmentIds, attachment.id]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '画像の追加に失敗しました。');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="attachment-picker">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        hidden
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button className="button button--ghost" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Icon name="image" />
        {uploading ? '追加中…' : '画像を追加'}
      </button>
      {uploading && (
        <div className="upload-progress" role="status" aria-label={`画像処理 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
          <button type="button" onClick={() => { cancelled.current = true; setUploading(false); setProgress(0); }}>中止</button>
        </div>
      )}
      <span className="field-hint">JPEG / PNG / WebP / GIF・入力8MB、保存2MBまで（自動圧縮）</span>
      {error && <p className="field-error" role="alert">{error}</p>}
      {attachments.length > 0 && (
        <div className="attachment-grid">
          {attachments.map((attachment) => (
            <figure key={attachment.id} className="attachment-preview">
              <img src={attachment.dataUrl} alt={attachment.name} onError={(event) => { event.currentTarget.alt = `${attachment.name}（読み込み失敗）`; }} />
              <button
                type="button"
                className="attachment-preview__remove"
                aria-label={`${attachment.name}を削除`}
                onClick={() => setPendingDelete(attachment)}
              >
                <Icon name="close" />
              </button>
            </figure>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="画像を削除しますか？"
        message={`画像「${pendingDelete?.name ?? ''}」を削除します。この操作は元に戻せません。`}
        onClose={() => setPendingDelete(undefined)}
        onConfirm={() => {
          if (pendingDelete) {
            actions.deleteAttachment(pendingDelete.id);
            onChange(attachmentIds.filter((id) => id !== pendingDelete.id));
          }
          setPendingDelete(undefined);
        }}
      />
    </div>
  );
}
