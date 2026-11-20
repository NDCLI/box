import React, { useState } from 'react';
import {
  FileArchive,
  FileCode,
  FileUp,
  ScanSearch,
  ShieldCheck,
  Zap,
  Server,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { CVATDataset } from '../types';
import CvatConnectPanel from './CvatConnectPanel';
import type { CvatConnection } from '../utils/cvatApi';

interface UploadZoneProps {
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onCvatDatasetLoaded: (dataset: CVATDataset, connection: CvatConnection, taskId: number, jobId?: number) => void;
}

const benefits = [
  { icon: ShieldCheck, label: 'Xử lý hoàn toàn cục bộ' },
  { icon: ScanSearch, label: 'Tìm box trùng và sai nhãn' },
  { icon: Zap, label: 'Có kết quả trong vài giây' },
];

export default function UploadZone({
  isDragging,
  fileInputRef,
  onUploadClick,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onCvatDatasetLoaded,
}: UploadZoneProps) {
  const [source, setSource] = useState<'cvat' | 'zip'>('cvat');
  const sources = [
    { id: 'cvat', label: 'CVAT Online', icon: Server },
    { id: 'zip', label: 'Offline', icon: FileArchive },
  ] as const;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mx-auto w-full max-w-4xl py-4"
      aria-labelledby="upload-title"
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="dt-mono inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--accent-text)]">
            CVAT ANNOTATION QA
          </span>
          <h1 id="upload-title" className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Cvat Tools
          </h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Chọn nguồn dữ liệu để kiểm tra box trùng, rà soát nhãn và xem thống kê.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Nguồn dữ liệu"
          className="inline-grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 self-start sm:self-auto"
        >
          {sources.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              id={`source-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={source === id}
              aria-controls={`source-panel-${id}`}
              tabIndex={source === id ? 0 : -1}
              onClick={() => { setSource(id); onDragLeave(); }}
              onKeyDown={(event) => {
                const next = event.key === 'Home' ? sources[0] : event.key === 'End' ? sources[1]
                  : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? sources[1 - index] : null;
                if (!next) return;
                event.preventDefault();
                setSource(next.id);
                onDragLeave();
                document.getElementById(`source-tab-${next.id}`)?.focus();
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                source === id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="app-upload-stage">
        <div id="source-panel-cvat" role="tabpanel" aria-labelledby="source-tab-cvat" hidden={source !== 'cvat'}>
          <CvatConnectPanel onDatasetLoaded={onCvatDatasetLoaded} />
        </div>

        <div id="source-panel-zip" role="tabpanel" aria-labelledby="source-tab-zip" hidden={source !== 'zip'}>
          <div className="dt-panel p-5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              accept=".xml,.zip"
              className="hidden"
            />

            <button
              type="button"
              id="upload-dropzone"
              aria-label="Chọn hoặc kéo thả tệp CVAT XML hay ZIP"
              onClick={onUploadClick}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`app-dropzone app-dropzone-primary ${isDragging ? 'is-dragging' : ''}`}
            >
              <span
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-primary)]"
                aria-hidden="true"
              >
                <FileUp className="h-6 w-6" />
              </span>
              <span className="dt-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Bắt đầu từ file annotation
              </span>
              <span className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">
                Chọn file XML hoặc ZIP
              </span>
              <span className="mt-1 text-xs text-[var(--text-secondary)]">
                Hoặc kéo thả file vào đây
              </span>
              <span className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-hidden="true">
                <span className="dt-mono inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <FileCode className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> CVAT XML
                </span>
                <span className="dt-mono inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <FileArchive className="h-3.5 w-3.5 text-[var(--status-info)]" /> ZIP archive
                </span>
              </span>
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--status-success)] shrink-0" aria-hidden="true" />
              <span>File được phân tích ngay trên trình duyệt, không rời khỏi thiết bị.</span>
            </p>
          </div>

          <div
            className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
            aria-label="Tính năng chính"
          >
            {benefits.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="dt-panel flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)]"
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
