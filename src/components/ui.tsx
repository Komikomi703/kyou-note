import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { ISODate } from '../types';
import { addDays, formatDate, todayISO } from '../lib/date';

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    today: <path d="M4 5.5h16v15H4zM8 3v5M16 3v5M4 10h16M8 14h2M14 14h2M8 17h2" />,
    calendar: <path d="M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />,
    tasks: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
    habits: <path d="M12 21c5-2.5 7-6.2 7-10.5C15.4 10.2 13 8 12 4c-1 4-3.4 6.2-7 6.5C5 14.8 7 18.5 12 21Z" />,
    goals: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
    reflection: <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
    reports: <path d="M4 20V10h4v10m4 0V4h4v16m4 0v-7h4v7M3 20h19" />,
    search: <path d="m20 20-4.5-4.5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />,
    settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5 1.5-1.2-2-3.5-1.9.7a7 7 0 0 0-1.7-1L15 5h-4l-.3 2a7 7 0 0 0-1.7 1l-1.9-.7-2 3.5L6.6 12l-1.5 1.2 2 3.5L9 16a7 7 0 0 0 1.7 1l.3 2h4l.3-2a7 7 0 0 0 1.7-1l1.9.7 2-3.5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    edit: <path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Zm10-13 3 3" />,
    trash: <path d="M4 7h16M9 3h6l1 4H8l1-4Zm-3 4 1 14h10l1-14M10 11v6M14 11v6" />,
    check: <path d="m5 12 4 4L19 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
    copy: <path d="M8 8h11v11H8zM5 16H4V5h11v1" />,
    bell: <path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5L6 17Zm4 2h4" />,
    image: <path d="M4 5h16v14H4zM7 15l3-3 2.5 2.5L15 12l3 3M9 9h.01" />,
    cloud: <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.8A3.1 3.1 0 0 0 7 18Z" />,
    info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-10h.01" />,
    moon: <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />,
    sparkles: <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14ZM6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14Z" />
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] ?? paths.more}
    </svg>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  wide = false,
  closeOnBackdrop = true
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  closeOnBackdrop?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let frame = 0;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      frame = window.requestAnimationFrame(() => {
        const target = dialog.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]), select, textarea, button');
        target?.focus();
      });
    }
    if (!open && dialog.open) {
      dialog.close();
      previousFocus.current?.focus();
    }
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog--wide' : ''}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === ref.current) onClose();
      }}
    >
      <div className="dialog__surface">
        <header className="dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="閉じる">
            <Icon name="close" />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </dialog>
  );
}

export function DateNavigator({ date, onChange }: { date: ISODate; onChange: (date: ISODate) => void }) {
  return (
    <div className="date-navigator">
      <button className="icon-button" onClick={() => onChange(addDays(date, -1))} aria-label="前日">
        <Icon name="chevronLeft" />
      </button>
      <label className="date-navigator__picker">
        <span className="date-navigator__label">{date === todayISO() ? '今日' : formatDate(date)}</span>
        <input type="date" value={date} onChange={(event) => onChange(event.target.value)} aria-label="日付を選択" />
      </label>
      <button className="icon-button" onClick={() => onChange(addDays(date, 1))} aria-label="翌日">
        <Icon name="chevronRight" />
      </button>
      {date !== todayISO() && (
        <button className="button button--ghost button--small" onClick={() => onChange(todayISO())}>
          今日へ
        </button>
      )}
    </div>
  );
}

export function ProgressBar({ value, label, subtle = false }: { value: number; label?: string; subtle?: boolean }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress ${subtle ? 'progress--subtle' : ''}`}
      role="progressbar"
      aria-label={label ?? '進捗'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
      aria-valuetext={`${safe}%`}
    >
      <div className="progress__track">
        <div className="progress__value" style={{ width: `${safe}%` }} />
      </div>
      {label && <span>{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon = 'cloud',
  title,
  description,
  action
}: {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true"><Icon name={icon} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '削除する',
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <p>{message}</p>
      <div className="dialog__actions">
        <button className="button button--ghost" onClick={onClose}>キャンセル</button>
        <button className="button button--danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}

export function Toast({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'error' | 'info' }) {
  return <div className={`toast toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}
