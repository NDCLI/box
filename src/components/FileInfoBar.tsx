import {
  FileCode,
  FileArchive,
  FolderOpen,
  RefreshCw,
  Server,
  X,
} from 'lucide-react';
import { type CVATDataset } from '../types';
import { type Entry } from '@zip.js/zip.js';
import type { JobCacheProgress } from '../utils/cvatApi';
import { useLocale } from '../i18n/LocaleProvider';
import StatusPill from './ui/StatusPill';

interface FileInfoBarProps {
  jobImageCache?: JobCacheProgress | null;
  compact?: boolean;
  file: File | null;
  dataset: CVATDataset;
  zipEntries: Entry[] | null;
  xmlFilesInZip: string[];
  selectedXmlPath: string;
  onXmlPathChange: (path: string) => void;
  onClose: () => void;
  onRefreshJob?: () => void;
  isRefreshingJob?: boolean;
  cvatScope?: 'Job' | 'Task';
  onOpenBackupFolder?: () => void;
}

export default function FileInfoBar({
  file,
  dataset,
  zipEntries,
  xmlFilesInZip,
  selectedXmlPath,
  onXmlPathChange,
  onClose,
  onRefreshJob,
  isRefreshingJob = false,
  cvatScope = 'Job',
  onOpenBackupFolder,
  compact = false,
  jobImageCache,
}: FileInfoBarProps) {
  const { locale } = useLocale();
  const vi = locale === 'vi';
  const isCvat = dataset.source === 'cvat';

  const cacheTone = jobImageCache?.state === 'complete'
    ? 'success'
    : jobImageCache?.state === 'error'
      ? 'warning'
      : jobImageCache?.state === 'running'
        ? 'info'
        : 'neutral';

  return (
    <div
      className={`app-panel app-file-bar ${compact ? 'app-file-bar-compact' : ''} flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5`}
    >
      <div className="file-bar-identity flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`file-bar-icon flex shrink-0 items-center justify-center rounded-lg border ${
            compact ? 'h-7 w-7' : 'h-8 w-8'
          } ${
            isCvat
              ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-primary)]'
              : 'border-[var(--status-info-border)] bg-[var(--status-info-subtle)] text-[var(--status-info)]'
          }`}
        >
          {isCvat ? (
            <Server className="h-4 w-4" />
          ) : zipEntries ? (
            <FileArchive className="h-4 w-4" />
          ) : (
            <FileCode className="h-4 w-4" />
          )}
        </span>

        <div className="file-bar-copy min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`file-bar-title truncate font-semibold text-[var(--text-primary)] ${compact ? 'text-xs' : 'text-[13px]'}`}
              title={dataset.taskName || file?.name}
            >
              {compact ? dataset.taskName || file?.name : (file?.name || dataset.filename)}
            </span>
            {!compact && !isCvat && file && (
              <span className="dt-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
            {!compact && (
              <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {dataset.type === 'images' ? 'Bộ sưu tập ảnh (Images)' : 'Chuỗi khung hình video (Tracks)'}
              </span>
            )}
          </div>
          {!compact && dataset.taskName && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
              Tên nhiệm vụ: <strong className="font-medium text-[var(--text-primary)]">{dataset.taskName}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="file-bar-actions flex flex-wrap items-center gap-2">
        {jobImageCache && (
          <StatusPill
            tone={cacheTone}
            dot
            pulse={jobImageCache.state === 'running'}
            title={jobImageCache.message || (vi ? 'Tự động lưu ảnh Job vào cache ổ đĩa' : 'Automatically caching all Job images')}
          >
            <span data-testid="job-image-cache" data-state={jobImageCache.state} role="status" className="dt-mono">
              {jobImageCache.state === 'complete'
                ? '✓ Cache'
                : jobImageCache.state === 'error'
                  ? (vi ? 'Lỗi cache' : 'Cache error')
                  : jobImageCache.state === 'stopped'
                    ? (vi ? 'Cache đã dừng' : 'Cache stopped')
                    : (vi ? 'Lưu cache' : 'Caching')}{' '}
              {jobImageCache.completed}/{jobImageCache.total}
            </span>
          </StatusPill>
        )}

        {zipEntries && xmlFilesInZip.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--text-secondary)] whitespace-nowrap">Chọn file XML:</span>
            <select
              value={selectedXmlPath}
              onChange={(e) => onXmlPathChange(e.target.value)}
              className="dt-select dt-select-sm max-w-[240px]"
            >
              {xmlFilesInZip.map((path) => (
                <option key={path} value={path}>
                  {path.length > 40 ? '...' + path.slice(-37) : path}
                </option>
              ))}
            </select>
          </div>
        )}

        {onRefreshJob && (
          <button
            type="button"
            onClick={onRefreshJob}
            disabled={isRefreshingJob}
            className="dt-btn dt-btn-primary dt-btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingJob ? 'animate-spin' : ''}`} />
            {isRefreshingJob ? 'Đang tải lại…' : `Tải lại ${cvatScope}`}
          </button>
        )}

        {onOpenBackupFolder && (
          <button
            type="button"
            onClick={onOpenBackupFolder}
            className="dt-btn dt-btn-warning dt-btn-sm"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Mở thư mục backup
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="dt-btn dt-btn-secondary dt-btn-sm"
        >
          <X className="h-3.5 w-3.5" />
          <span>{onRefreshJob ? `Đóng ${cvatScope}` : 'Đóng file'}</span>
        </button>
      </div>
    </div>
  );
}
