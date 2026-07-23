import {
  FileCode,
  FileArchive,
  X
} from 'lucide-react';
import { type CVATDataset } from '../types';
import { type Entry } from '@zip.js/zip.js';

interface FileInfoBarProps {
  file: File | null;
  dataset: CVATDataset;
  zipEntries: Entry[] | null;
  xmlFilesInZip: string[];
  selectedXmlPath: string;
  onXmlPathChange: (path: string) => void;
  onClose: () => void;
}

export default function FileInfoBar({
  file,
  dataset,
  zipEntries,
  xmlFilesInZip,
  selectedXmlPath,
  onXmlPathChange,
  onClose
}: FileInfoBarProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center space-x-3.5">
        <div className="p-3 bg-red-50 rounded-xl text-red-500">
          {zipEntries ? <FileArchive className="w-6 h-6" /> : <FileCode className="w-6 h-6" />}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900 break-all">{file?.name}</span>
            <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-medium shrink-0">
              {(file ? file.size / 1024 / 1024 : 0).toFixed(2)} MB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kiểu CVAT: <strong className="text-slate-700">{dataset.type === 'images' ? 'Bộ sưu tập ảnh (Images)' : 'Chuỗi khung hình video (Tracks)'}</strong>
            {dataset.taskName && <> | Tên nhiệm vụ: <strong className="text-slate-700">{dataset.taskName}</strong></>}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 self-end md:self-auto">
        {/* XML file selector if inside ZIP */}
        {zipEntries && xmlFilesInZip.length > 1 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Chọn file XML:</span>
            <select
              value={selectedXmlPath}
              onChange={(e) => onXmlPathChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
            >
              {xmlFilesInZip.map(path => (
                <option key={path} value={path}>
                  {path.length > 40 ? '...' + path.slice(-37) : path}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={onClose}
          className="inline-flex items-center space-x-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Đóng file</span>
        </button>
      </div>
    </div>
  );
}
