import {
  FileCheck,
  Search,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type CVATDataset, type DuplicateGroup, type DetectionSettings } from '../types';

interface DuplicateListProps {
  dataset: CVATDataset;
  duplicateGroups: DuplicateGroup[];
  filteredDuplicateGroups: DuplicateGroup[];
  baseFilteredGroups: DuplicateGroup[];
  paginatedGroups: DuplicateGroup[];
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  selectedLabels: string[];
  onLabelToggle: (label: string) => void;
  onSelectAllLabels: () => void;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  settings: DetectionSettings;
}

export default function DuplicateList({
  dataset,
  duplicateGroups,
  filteredDuplicateGroups,
  baseFilteredGroups,
  paginatedGroups,
  searchTerm,
  onSearchTermChange,
  selectedLabels,
  onLabelToggle,
  onSelectAllLabels,
  selectedGroupId,
  onSelectGroup,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  settings
}: DuplicateListProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

      {/* Left Column: Duplicate Groups Directory */}
      <div className="lg:col-span-12 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col min-h-[600px]">

        {/* Search and Filters Header */}
        <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center space-x-2">
              <span>Danh sách trùng lặp ({filteredDuplicateGroups.length})</span>
              {filteredDuplicateGroups.length !== duplicateGroups.length && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-normal">
                  Lọc từ {duplicateGroups.length}
                </span>
              )}
            </h3>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên ảnh hoặc ID frame..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all"
            />
          </div>

          {/* Labels filter badges */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-wider">
              <span>LỌC THEO NHÃN (LABELS)</span>
              <button onClick={onSelectAllLabels} className="text-red-500 hover:text-red-600 transition-colors">
                Chọn tất cả
              </button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto pr-1">
              {dataset.labels.map(label => {
                const isSelected = selectedLabels.includes(label);
                const countInDuplicates = baseFilteredGroups.reduce((sum, g) => {
                  const matches = g.boxes.filter(b => b.label === label);
                  if (matches.length > 1) {
                    return sum + (matches.length - 1);
                  } else if (matches.length === 1 && g.boxes.length > 1 && !settings.matchLabelOnly) {
                    return sum + 1;
                  }
                  return sum;
                }, 0);

                if (countInDuplicates === 0) return null; // Only show labels that actually have duplicates

                return (
                  <button
                    key={label}
                    onClick={() => onLabelToggle(label)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center space-x-1 border transition-all ${isSelected
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                  >
                    <span>{label}</span>
                    <span className={`rounded-full px-1 py-0.2 text-[8px] ${isSelected ? 'bg-red-200/55' : 'bg-slate-200 text-slate-500'}`}>
                      {countInDuplicates}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List Container */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 bg-slate-50/50"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {paginatedGroups.length > 0 ? (
              paginatedGroups.map((group, index) => {
                const isSelected = selectedGroupId === group.id;
                const absoluteIndex = (currentPage - 1) * itemsPerPage + index + 1;

                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    onClick={() => onSelectGroup(group.id)}
                    className={`p-4 flex flex-col justify-between cursor-pointer transition-all rounded-2xl border shadow-xs ${isSelected
                      ? 'bg-red-50/50 border-red-300 ring-2 ring-red-500/20'
                      : 'bg-white border-slate-200 hover:border-red-300 hover:shadow-md'
                      }`}
                  >
                    <div className="min-w-0 pr-3">
                      {/* Tiêu đề chính: Frame ID to rõ */}
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold text-slate-400 font-mono">
                          #{absoluteIndex}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">
                          Frame {group.frameId}
                        </span>
                        <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                          {group.boxes.length} box trùng
                        </span>
                      </div>

                      {/* Tên ảnh phụ + IoU + nhãn */}
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
                        <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={group.frameName}>
                          📁 {group.frameName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          IoU: {group.overlapPercentage}%
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded truncate max-w-[120px]">
                          {Array.from(new Set(group.boxes.map(b => b.label))).join(', ')}
                        </span>
                      </div>

                      {/* Chi tiết toạ độ box */}
                      <div className="mt-1.5 space-y-0.5">
                        {group.boxes.some(b => b.trackId) && (
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded inline-block mb-0.5">
                            Tracks: {Array.from(new Set(group.boxes.filter(b => b.trackId).map(b => b.trackId))).join(', ')}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                          {group.boxes.slice(0, 2).map((box, _bIdx) => (
                            <span key={box.id} className="block truncate">
                              <span className="text-slate-600 font-bold mr-1">
                                #{box.globalIndex}
                              </span>
                              {box.label}: [{box.xtl.toFixed(1)}, {box.ytl.toFixed(1)}, {box.xbr.toFixed(1)}, {box.ybr.toFixed(1)}]
                            </span>
                          ))}
                          {group.boxes.length > 2 && (
                            <span className="text-slate-400 font-semibold">...+{group.boxes.length - 2} box khác</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-red-500' : ''
                      }`} />
                  </motion.div>
                );
              })
            ) : (
              <div className="py-20 text-center flex flex-col items-center justify-center p-6 text-slate-400">
                <FileCheck className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-bold text-sm text-slate-700">Không tìm thấy trùng lặp nào</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  {duplicateGroups.length > 0
                    ? 'Không có kết quả khớp với bộ lọc tìm kiếm và nhãn của bạn.'
                    : 'Không có lỗi trùng lặp nào được phát hiện trong file dữ liệu này!'
                  }
                </p>
              </div>
            )}
          </AnimatePresence>
          </div>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 rounded-b-3xl">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-[11px] font-bold text-slate-500 font-mono">
              Trang {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
