import {
  FileCheck,
  Search,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Check,
  Square,
  Eye
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { type CVATDataset, type CVATFrameData, type DuplicateGroup, type DetectionSettings, type DuplicateSelection } from '../types';
import { getLabelColor } from '../constants/colors';

type QuickViewBox = { x: number; y: number; width: number; height: number };

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
  selectedGroupIds: string[];
  onToggleGroup: (groupId: string) => void;
  selectionByBoxId: Record<string, DuplicateSelection>;
  onBoxSelection: (boxId: string, selection: DuplicateSelection) => void;
  onDeleteSelected: () => void;
  canDelete: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  settings: DetectionSettings;
  quickReviewGroup: DuplicateGroup | null;
  quickReviewFrameData: CVATFrameData | null;
  quickReviewImageSrc: string | null;
  quickReviewImageLoading: boolean;
  quickReviewImageError: string | null;
  quickReviewImageDimensions: { width: number; height: number } | null;
  onOpenPreview: () => void;
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
  selectedGroupIds,
  onToggleGroup,
  selectionByBoxId,
  onBoxSelection,
  onDeleteSelected,
  canDelete,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  settings,
  quickReviewGroup,
  quickReviewFrameData,
  quickReviewImageSrc,
  quickReviewImageLoading,
  quickReviewImageError,
  quickReviewImageDimensions,
  onOpenPreview
}: DuplicateListProps) {
  const [quickViewBox, setQuickViewBox] = useState<QuickViewBox | null>(null);
  const quickReviewRef = useRef<HTMLDivElement | null>(null);

  const deleteBoxCount = new Set(
    duplicateGroups.flatMap(group => group.boxes)
      .filter(box => selectionByBoxId[box.id] === 'delete')
      .map(box => box.id)
  ).size;

  const quickReviewSourceWidth = quickReviewImageDimensions?.width || quickReviewFrameData?.width || 1;
  const quickReviewSourceHeight = quickReviewImageDimensions?.height || quickReviewFrameData?.height || 1;
  const quickReviewBounds = quickReviewGroup && quickReviewFrameData ? (() => {
    const minX = Math.min(...quickReviewGroup.boxes.map(box => box.xtl));
    const minY = Math.min(...quickReviewGroup.boxes.map(box => box.ytl));
    const maxX = Math.max(...quickReviewGroup.boxes.map(box => box.xbr));
    const maxY = Math.max(...quickReviewGroup.boxes.map(box => box.ybr));
    const boxSize = Math.max(maxX - minX, maxY - minY);
    const padding = Math.max(18, Math.min(100, boxSize * 0.3));
    const x = Math.max(0, minX - padding);
    const y = Math.max(0, minY - padding);
    const right = Math.min(quickReviewSourceWidth, maxX + padding);
    const bottom = Math.min(quickReviewSourceHeight, maxY + padding);
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  })() : null;

  useEffect(() => {
    setQuickViewBox(null);
  }, [quickReviewGroup?.id, quickReviewSourceWidth, quickReviewSourceHeight]);

  const activeQuickViewBox = quickViewBox ?? quickReviewBounds;
  const quickOverlayScale = quickReviewBounds && activeQuickViewBox
    ? Math.max(0.1, activeQuickViewBox.width / quickReviewBounds.width)
    : 1;

  const handleQuickReviewWheel = (event: WheelEvent) => {
    if (!quickReviewBounds) return;
    event.preventDefault();
    event.stopPropagation();
    const current = activeQuickViewBox ?? quickReviewBounds;
    const rect = quickReviewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const zoomFactor = event.deltaY < 0 ? 0.8 : 1.25;
    const minWidth = quickReviewBounds.width / 8;
    const minHeight = quickReviewBounds.height / 8;
    const nextWidth = Math.min(quickReviewBounds.width, Math.max(minWidth, current.width * zoomFactor));
    const nextHeight = Math.min(quickReviewBounds.height, Math.max(minHeight, current.height * zoomFactor));
    const focusX = current.x + current.width * pointerX;
    const focusY = current.y + current.height * pointerY;
    const nextX = Math.min(
      quickReviewBounds.x + quickReviewBounds.width - nextWidth,
      Math.max(quickReviewBounds.x, focusX - nextWidth * pointerX),
    );
    const nextY = Math.min(
      quickReviewBounds.y + quickReviewBounds.height - nextHeight,
      Math.max(quickReviewBounds.y, focusY - nextHeight * pointerY),
    );
    setQuickViewBox({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
  };

  useEffect(() => {
    const element = quickReviewRef.current;
    if (!element || !quickReviewBounds) return;
    element.addEventListener('wheel', handleQuickReviewWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleQuickReviewWheel);
  }, [quickReviewBounds, activeQuickViewBox]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

      {/* Left Column: Duplicate Groups Directory */}
      <div className="app-panel app-duplicate-list lg:col-span-12 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col min-h-[600px]">

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
            {canDelete && (
              <button
                type="button"
                onClick={onDeleteSelected}
                disabled={deleteBoxCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa box đã chọn ({deleteBoxCount})
              </button>
            )}
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
                        {canDelete && (
                          <button
                            type="button"
                            aria-label={`Chọn nhóm Frame ${group.frameId}`}
                            onClick={(event) => { event.stopPropagation(); onToggleGroup(group.id); }}
                            className="text-slate-500 hover:text-red-600"
                          >
                            {selectedGroupIds.includes(group.id) ? <Check className="h-4 w-4 text-red-600" /> : <Square className="h-4 w-4" />}
                          </button>
                        )}
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

                      {quickReviewGroup?.id === group.id && quickReviewFrameData && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                          {canDelete && (
                            <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 px-2 py-1.5 text-[10px] text-slate-300">
                              <span className="mr-1 text-slate-400">Chọn box xóa:</span>
                              {group.boxes.map((box, boxIndex) => {
                                const markedDelete = selectionByBoxId[box.id] === 'delete';
                                const letter = String.fromCharCode(65 + boxIndex);
                                return (
                                  <button
                                    key={box.id}
                                    type="button"
                                    disabled={box.annotationKind === 'track'}
                                    aria-pressed={markedDelete}
                                    title={markedDelete ? `Box ${letter}: bỏ đánh dấu xóa` : `Box ${letter}: đánh dấu xóa`}
                                    onClick={(event) => { event.stopPropagation(); onBoxSelection(box.id, markedDelete ? 'keep' : 'delete'); }}
                                    className={`min-w-6 rounded px-1.5 py-0.5 font-black disabled:opacity-40 ${markedDelete ? 'bg-red-500 text-white' : 'bg-emerald-700 text-white hover:bg-red-500'}`}
                                  >
                                    {letter}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div ref={quickReviewRef} className="relative h-64 w-full select-none" title="Cuộn chuột để zoom vào cạnh box">
                            {quickReviewImageSrc && activeQuickViewBox ? (
                              <svg
                                viewBox={`${activeQuickViewBox.x} ${activeQuickViewBox.y} ${activeQuickViewBox.width} ${activeQuickViewBox.height}`}
                                preserveAspectRatio="none"
                                className="absolute inset-0 h-full w-full"
                              >
                                <image href={quickReviewImageSrc} x="0" y="0" width={quickReviewSourceWidth} height={quickReviewSourceHeight} preserveAspectRatio="none" />
                                {group.boxes.map((box, boxIndex) => {
                                  const markedDelete = selectionByBoxId[box.id] === 'delete';
                                  const color = markedDelete ? '#ef4444' : getLabelColor(box.label, dataset);
                                  const badgeRadius = Math.max(1.5, 4 * quickOverlayScale);
                                  const badgeOffset = boxIndex * badgeRadius * 2.4;
                                  return (
                                    <g
                                      key={box.id}
                                      className="cursor-pointer"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (canDelete && box.annotationKind !== 'track') {
                                          onBoxSelection(box.id, markedDelete ? 'keep' : 'delete');
                                        }
                                      }}
                                    >
                                      <rect
                                        x={box.xtl}
                                        y={box.ytl}
                                        width={Math.max(0, box.xbr - box.xtl)}
                                        height={Math.max(0, box.ybr - box.ytl)}
                                        fill={markedDelete ? '#ef444433' : '#10b98122'}
                                        stroke={color}
                                        strokeWidth="4"
                                        strokeDasharray={markedDelete ? '10,7' : undefined}
                                        vectorEffect="non-scaling-stroke"
                                      />
                                      <g pointerEvents="none">
                                        <circle cx={box.xtl + badgeRadius + badgeOffset} cy={box.ytl + badgeRadius} r={badgeRadius} fill={color} />
                                        <text x={box.xtl + badgeRadius + badgeOffset} y={box.ytl + badgeRadius * 1.4} fill="#ffffff" fontSize={Math.max(2, badgeRadius * 1.4)} fontWeight="700" textAnchor="middle">
                                          {String.fromCharCode(65 + boxIndex)}
                                        </text>
                                      </g>
                                    </g>
                                  );
                                })}
                              </svg>
                            ) : (
                              <div className="absolute inset-0 grid place-items-center px-3 text-center text-[10px] text-slate-400">
                                {quickReviewImageLoading ? 'Đang tải ảnh frame…' : (quickReviewImageError || 'Không có ảnh, chỉ hiển thị khung tọa độ')}
                              </div>
                            )}
                          </div>
                          <div className="border-t border-slate-700 text-[10px] text-slate-300">
                            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                              <span>Cuộn để zoom cạnh box · Chưa chọn = giữ · Đỏ = xóa</span>
                              <div className="flex items-center gap-1">
                                {quickViewBox && (
                                  <button type="button" onClick={(event) => { event.stopPropagation(); setQuickViewBox(null); }} className="rounded bg-slate-700 px-2 py-1 font-bold text-white hover:bg-slate-600">Đặt lại</button>
                                )}
                                <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPreview(); }} className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 font-bold text-white hover:bg-slate-600">
                                  <Eye className="h-3 w-3" /> Mở kiểm tra chi tiết
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Chi tiết toạ độ box */}
                      <div className="mt-1.5 space-y-0.5">
                        {group.boxes.some(b => b.trackId) && (
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded inline-block mb-0.5">
                            Tracks: {Array.from(new Set(group.boxes.filter(b => b.trackId).map(b => b.trackId))).join(', ')}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                          {group.boxes.map((box, _bIdx) => (
                            <span key={box.id} className="mb-1 block truncate">
                              <span className="text-slate-600 font-bold mr-1">
                                #{box.globalIndex}
                              </span>
                              {box.label}: [{box.xtl.toFixed(1)}, {box.ytl.toFixed(1)}, {box.xbr.toFixed(1)}, {box.ybr.toFixed(1)}]
                              {canDelete && (
                                <span className="ml-1 inline-flex gap-1 font-sans">
                                  <button type="button" disabled={box.annotationKind === 'track'} onClick={(event) => { event.stopPropagation(); onBoxSelection(box.id, selectionByBoxId[box.id] === 'delete' ? 'keep' : 'delete'); }} className={`rounded px-1 ${selectionByBoxId[box.id] === 'delete' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'} disabled:opacity-40`}>{selectionByBoxId[box.id] === 'delete' ? 'Bỏ xóa' : 'Xóa'}</button>
                                </span>
                              )}
                            </span>
                          ))}
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
