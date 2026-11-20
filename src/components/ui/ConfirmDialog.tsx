import { useEffect, useRef } from 'react';
import { AlertTriangle, ShieldCheck, Trash2, X } from 'lucide-react';
import type { Locale } from '../../i18n/LocaleProvider';

export interface DeleteConfirmationState {
  jobId: number;
  frames: string[];
  deleteCount: number;
  keepCount: number;
  source: 'list' | 'preview';
}

interface ConfirmDialogProps {
  confirmation: DeleteConfirmationState | null;
  locale: Locale;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  confirmation,
  locale,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const vi = locale === 'vi';

  useEffect(() => {
    if (!confirmation) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation, isSubmitting, onCancel]);

  if (!confirmation) return null;

  const framePreview = confirmation.frames.length > 10
    ? `${confirmation.frames.slice(0, 10).join(', ')} (+${confirmation.frames.length - 10})`
    : confirmation.frames.join(', ');

  return (
    <div
      className="dt-modal-backdrop fixed inset-0 z-[130] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <div className="dt-modal w-full max-w-md overflow-hidden rounded-xl animate-[modalIn_0.16s_ease-out_both]">
        <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--status-danger-subtle)] text-[var(--status-danger)] border border-[var(--status-danger-border)]">
            <AlertTriangle className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-delete-title" className="text-sm font-semibold text-[var(--text-primary)]">
              {vi ? `Xác nhận xóa Shape trên CVAT Job #${confirmation.jobId}` : `Confirm CVAT Shape deletion (Job #${confirmation.jobId})`}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {vi
                ? 'Thao tác này sẽ gửi lệnh PATCH xóa trực tiếp các Shape đã đánh dấu trên máy chủ CVAT.'
                : 'This will send a PATCH delete request directly to the CVAT server for the marked Shapes.'}
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="dt-icon-btn"
            aria-label={vi ? 'Đóng' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-3 py-2.5">
              <div className="text-[11px] font-medium text-[var(--status-danger-text)]">
                {vi ? 'Shape sẽ xóa' : 'Shapes to delete'}
              </div>
              <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[var(--status-danger)]">
                {confirmation.deleteCount}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-subtle)] px-3 py-2.5">
              <div className="text-[11px] font-medium text-[var(--status-success-text)]">
                {vi ? 'Shape được giữ lại' : 'Shapes kept'}
              </div>
              <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[var(--status-success)]">
                {confirmation.keepCount}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {vi ? `Frame bị ảnh hưởng (${confirmation.frames.length})` : `Affected frames (${confirmation.frames.length})`}
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--text-primary)] break-words">
              {framePreview}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-success)]" />
            <span>
              {vi
                ? 'Hệ thống tự động kiểm tra trạng thái server trước khi xóa, lưu bản sao JSON phục hồi cục bộ và xác minh lại sau khi xóa.'
                : 'The app automatically verifies server state before deleting, saves a local JSON recovery backup, and re-verifies afterward.'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-5 py-3">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="dt-btn dt-btn-secondary"
          >
            {vi ? 'Hủy' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="dt-btn dt-btn-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isSubmitting
              ? (vi ? 'Đang xóa…' : 'Deleting…')
              : (vi ? `Xác nhận xóa (${confirmation.deleteCount})` : `Confirm delete (${confirmation.deleteCount})`)}
          </button>
        </div>
      </div>
    </div>
  );
}
