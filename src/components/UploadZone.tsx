import React from 'react';
import {
  FileUp,
  FileCode,
  FileArchive,
  Info,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';

interface UploadZoneProps {
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export default function UploadZone({
  isDragging,
  fileInputRef,
  onUploadClick,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop
}: UploadZoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Left side: Upload card */}
      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-between min-h-[420px]">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Tải tệp dữ liệu lên</h3>
          <p className="text-sm text-slate-500 mb-6">
            Chọn hoặc kéo thả file XML/ZIP xuất từ CVAT để thống kê số box, lọc theo Frame Range, tính Exclude Labels, Frame Skip và kiểm tra Duplicate Boxes.
          </p>
        </div>

        {/* Drop area */}
        <div
          id="upload-dropzone"
          onClick={onUploadClick}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group ${isDragging
            ? 'border-red-500 bg-red-50/40 scale-[0.99]'
            : 'border-slate-300 hover:border-red-400 hover:bg-slate-50/50'
            }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            accept=".xml,.zip"
            className="hidden"
          />


          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-4 group-hover:scale-110 transition-transform duration-200">
            <FileUp className="w-8 h-8" />
          </div>

          <span className="text-base font-semibold text-slate-800 mb-1 group-hover:text-red-500">
            Kéo thả tệp XML hoặc ZIP vào đây
          </span>
          <span className="text-xs text-slate-400">
            Hoặc click để chọn từ thiết bị (Hỗ trợ XML đơn hoặc ZIP gói đầy đủ)
          </span>

          <div className="mt-6 flex space-x-3 text-xs text-slate-400 items-center">
            <span className="flex items-center"><FileCode className="w-3.5 h-3.5 mr-1" /> CVAT XML</span>
            <span className="border-r border-slate-200 h-3"></span>
            <span className="flex items-center"><FileArchive className="w-3.5 h-3.5 mr-1" /> ZIP File</span>
          </div>


        </div>

        <div className="mt-6 text-xs text-slate-400 flex items-start space-x-2 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Bảo mật:</strong> Tệp tin của bạn được phân tích cục bộ hoàn toàn trên trình duyệt của bạn bằng JavaScript. Không có dữ liệu hình ảnh hay chú thích nào được tải lên máy chủ ngoài.
          </span>
        </div>
      </div>

      {/* Right side: Instructions and info */}
      <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-8 flex flex-col justify-between shadow-xl shadow-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-20 -translate-y-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl"></div>

        <div>
          <div className="inline-flex items-center space-x-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Box Audit Toolkit</span>
          </div>

          <h3 className="text-xl font-bold tracking-tight mb-4">Tính năng chính</h3>

          <ul className="space-y-4 text-sm text-slate-300">
            <li className="flex items-start space-x-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">1</span>
              <span><strong>Parse CVAT XML/ZIP:</strong> Đọc annotations từ định dạng Images hoặc Tracks.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">2</span>
              <span><strong>Box Counting:</strong> Tính số lượng Bounding Box theo Frame Range, Exclude Labels, Frame Skip và Passed frame.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">3</span>
              <span><strong>Duplicate Inspector:</strong> Quét Duplicate Boxes theo Pixel Match hoặc IoU, có tuỳ chọn chỉ tính trùng khi cùng Label.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">4</span>
              <span><strong>Visual Debug:</strong> Hiển thị ảnh/SVG đầy đủ, zoom vào vùng lỗi và lọc nhanh theo Frame, Label để kiểm tra annotation trực quan.</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
          <span>Version v1.0</span>
          <span>CVAT XML / ZIP Support</span>
        </div>
      </div>
    </motion.div>
  );
}
