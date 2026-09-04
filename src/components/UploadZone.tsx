import React from 'react';
import {
  FileArchive,
  FileCode,
  FileUp,
  ScanSearch,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { CVATDataset } from '../types';
import CvatConnectPanel from './CvatConnectPanel';

interface UploadZoneProps {
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onCvatDatasetLoaded: (dataset: CVATDataset) => void;
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
  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-empty-state"
      aria-labelledby="upload-title"
    >
      <div className="app-empty-heading">
        <span className="app-eyebrow">CVAT ANNOTATION QA</span>
        <h1 id="upload-title">CVAT Box Audit</h1>
        <p>
          Mở file annotation để kiểm tra box trùng, rà soát nhãn và xem nhanh thống kê dữ liệu.
        </p>
      </div>

      <div className="app-upload-stage">
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

        <CvatConnectPanel onDatasetLoaded={onCvatDatasetLoaded} />
      </div>

      <div className="app-benefits" aria-label="Tính năng chính">
        {benefits.map(({ icon: Icon, label }) => (
          <div className="app-benefit" key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
