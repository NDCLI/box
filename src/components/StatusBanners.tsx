import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

interface StatusBannersProps {
  isLoading: boolean;
  error: string | null;
  successMsg: string | null;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}

function StatusBanners({
  isLoading,
  error,
  successMsg,
  onDismissError,
  onDismissSuccess,
}: StatusBannersProps) {
  return (
    <>
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="dt-panel flex items-center gap-3 px-4 py-3 text-sm"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--accent-primary)]" />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">Đang đọc và xử lý tệp dữ liệu...</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Quá trình này có thể mất vài giây tùy thuộc vào dung lượng file.
            </p>
          </div>
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-3.5 py-2.5 text-[var(--status-danger-text)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-danger)]" />
          <div className="min-w-0 flex-1 text-xs">
            <h5 className="font-semibold text-[var(--text-primary)]">Đã xảy ra lỗi</h5>
            <p className="mt-0.5 whitespace-pre-line leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="dt-icon-btn h-6 w-6 text-[var(--status-danger-text)]"
            aria-label="Đóng"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-subtle)] px-3.5 py-2.5 text-[var(--status-success-text)]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />
          <div className="min-w-0 flex-1 text-xs font-medium">{successMsg}</div>
          <button
            type="button"
            onClick={onDismissSuccess}
            className="dt-icon-btn h-6 w-6 text-[var(--status-success-text)]"
            aria-label="Đóng"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </>
  );
}

export default StatusBanners;
