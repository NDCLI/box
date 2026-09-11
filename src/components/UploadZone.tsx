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
  const sources = [{ id: 'cvat', label: 'CVAT Online', icon: Server }, { id: 'zip', label: 'Offline', icon: FileArchive }] as const;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-empty-state"
      aria-labelledby="upload-title"
    >
      <div className="app-empty-heading">
        <span className="app-eyebrow">CVAT ANNOTATION QA</span>
        <h1 id="upload-title">Cvat Tools</h1>
        <p>
          Chọn nguồn dữ liệu để kiểm tra box trùng, rà soát nhãn và xem thống kê.
        </p>
      </div>

      <div className="app-upload-stage">
        <div role="tablist" aria-label="Nguồn dữ liệu" className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-1.5">
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
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-colors ${source === id ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <div id="source-panel-cvat" role="tabpanel" aria-labelledby="source-tab-cvat" hidden={source !== 'cvat'}>
          <CvatConnectPanel onDatasetLoaded={onCvatDatasetLoaded} />
        </div>

        <div id="source-panel-zip" role="tabpanel" aria-labelledby="source-tab-zip" hidden={source !== 'zip'}>

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
          <span className="app-upload-icon" aria-hidden="true">
            <FileUp />
          </span>
          <span className="app-upload-kicker">Bắt đầu từ file annotation</span>
          <span className="app-upload-action">Chọn file XML hoặc ZIP</span>
          <span className="app-upload-helper">Hoặc kéo thả file vào đây</span>
          <span className="app-file-types" aria-hidden="true">
            <span><FileCode /> CVAT XML</span>
            <span><FileArchive /> ZIP archive</span>
          </span>
        </button>

        <p className="app-upload-security">
          <ShieldCheck aria-hidden="true" /> File được phân tích ngay trên trình duyệt, không rời khỏi thiết bị.
        </p>
        </div>

      </div>

      <div hidden={source !== 'zip'}>
      <div className="app-benefits" aria-label="Tính năng chính">
        {benefits.map(({ icon: Icon, label }) => (
          <div className="app-benefit" key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </div>
        ))}
      </div>
      </div>
    </motion.section>
  );
}
