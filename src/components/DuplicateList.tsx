import {
  FileCheck,
  Search,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Check,
  Square,
  Eye,
  LayoutGrid,
  TableProperties,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type CVATDataset, type CVATFrameData, type DuplicateGroup, type DetectionSettings, type DuplicateSelection } from '../types';
import { getLabelColor } from '../constants/colors';
import { useLocale } from '../i18n/LocaleProvider';

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
  onDeleteGroup?: (group: DuplicateGroup) => void;
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
  onDeleteGroup,
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
  onOpenPreview,
}: DuplicateListProps) {
  const { locale } = useLocale();
  const vi = locale === 'vi';
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [quickViewBox, setQuickViewBox] = useState<QuickViewBox | null>(null);
  const quickReviewRef = useRef<HTMLDivElement | null>(null);

  const deleteBoxCount = new Set(
    duplicateGroups
      .flatMap((group) => group.boxes)
      .filter((box) => selectionByBoxId[box.id] === 'delete')
      .map((box) => box.id),
  ).size;

  const quickReviewDeleteCount = quickReviewGroup
    ? quickReviewGroup.boxes.filter((box) => selectionByBoxId[box.id] === 'delete').length
    : 0;

  const quickReviewSourceWidth = quickReviewImageDimensions?.width || quickReviewFrameData?.width || 1;
  const quickReviewSourceHeight = quickReviewImageDimensions?.height || quickReviewFrameData?.height || 1;
  const quickReviewBounds = quickReviewGroup && quickReviewFrameData ? (() => {
    const minX = Math.min(...quickReviewGroup.boxes.map((box) => box.xtl));
    const minY = Math.min(...quickReviewGroup.boxes.map((box) => box.ytl));
    const maxX = Math.max(...quickReviewGroup.boxes.map((box) => box.xbr));
    const maxY = Math.max(...quickReviewGroup.boxes.map((box) => box.ybr));
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

  const handleRowKeyDown = (event: React.KeyboardEvent, index: number, group: DuplicateGroup) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedGroupId === group.id) onOpenPreview();
      else onSelectGroup(group.id);
    } else if (event.key === ' ') {
      event.preventDefault();
      onSelectGroup(group.id);
    } else if (event.key === 'ArrowDown' && index < paginatedGroups.length - 1) {
      event.preventDefault();
      onSelectGroup(paginatedGroups[index + 1].id);
    } else if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      onSelectGroup(paginatedGroups[index - 1].id);
    }
  };

  const labelBadges = dataset.labels
    .map((label) => {
      const countInDuplicates = baseFilteredGroups.reduce((sum, g) => {
        const matches = g.boxes.filter((b) => b.label === label);
        if (matches.length > 1) return sum + (matches.length - 1);
        if (matches.length === 1 && g.boxes.length > 1 && !settings.matchLabelOnly) return sum + 1;
        return sum;
      }, 0);
      return { label, countInDuplicates };
    })
    .filter((item) => item.countInDuplicates > 0);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
      {/* Master Pane: Duplicate Directory */}
      <div className="app-panel app-duplicate-list flex min-h-[540px] flex-col overflow-hidden lg:col-span-6 xl:col-span-6">
        {/* Directory Toolbar */}
        <div className="space-y-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Danh sách trùng lặp ({filteredDuplicateGroups.length})
              </h3>
              {filteredDuplicateGroups.length !== duplicateGroups.length && (
                <span className="dt-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
                  Lọc từ {duplicateGroups.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md p-1 transition-colors ${
                    viewMode === 'table'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title={vi ? 'Dạng bảng dữ liệu' : 'Table view'}
                  aria-label={vi ? 'Dạng bảng dữ liệu' : 'Table view'}
                >
                  <TableProperties className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-md p-1 transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title={vi ? 'Dạng thẻ' : 'Card view'}
                  aria-label={vi ? 'Dạng thẻ' : 'Card view'}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={onDeleteSelected}
                  disabled={deleteBoxCount === 0}
                  className="dt-btn dt-btn-danger dt-btn-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa box đã chọn ({deleteBoxCount})
                </button>
              )}
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Tìm theo tên ảnh hoặc ID frame..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="dt-input dt-input-sm w-full pl-8"
            />
          </div>

          {/* Label filter chips */}
          {labelBadges.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <span>LỌC THEO NHÃN (LABELS)</span>
                <button
                  type="button"
                  onClick={onSelectAllLabels}
                  className="text-[var(--accent-text)] hover:underline"
                >
                  Chọn tất cả
                </button>
              </div>
              <div className="flex max-h-[64px] flex-wrap gap-1 overflow-y-auto pr-1">
                {labelBadges.map(({ label, countInDuplicates }) => {
                  const isSelected = selectedLabels.includes(label);
                  const dotColor = getLabelColor(label, dataset);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onLabelToggle(label)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      <span>{label}</span>
                      <span className="dt-mono text-[10px] opacity-75">{countInDuplicates}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* List / Table Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {paginatedGroups.length > 0 ? (
            viewMode === 'table' ? (
              <table className="dt-table">
                <thead>
                  <tr>
                    {canDelete && <th className="w-8"></th>}
                    <th className="w-10">#</th>
                    <th>Frame</th>
                    <th className="hidden xl:table-cell">{vi ? 'Tên ảnh' : 'Image'}</th>
                    <th>{vi ? 'Nhãn' : 'Labels'}</th>
                    <th className="text-right">Box</th>
                    <th className="text-right">IoU</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGroups.map((group, index) => {
                    const isSelected = selectedGroupId === group.id;
                    const absoluteIndex = (currentPage - 1) * itemsPerPage + index + 1;
                    const markedInGroup = group.boxes.filter((b) => selectionByBoxId[b.id] === 'delete').length;
                    const uniqueLabels = Array.from(new Set(group.boxes.map((b) => b.label)));

                    return (
                      <tr
                        key={group.id}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => onSelectGroup(group.id)}
                        onDoubleClick={() => { onSelectGroup(group.id); onOpenPreview(); }}
                        onKeyDown={(e) => handleRowKeyDown(e, index, group)}
                        className={`cursor-pointer ${isSelected ? 'is-selected' : ''}`}
                      >
                        {canDelete && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              aria-label={`Chọn nhóm Frame ${group.frameId}`}
                              onClick={() => onToggleGroup(group.id)}
                              className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                            >
                              {selectedGroupIds.includes(group.id) ? (
                                <Check className="h-3.5 w-3.5 text-[var(--status-danger)]" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="dt-mono text-[11px] text-[var(--text-muted)]">#{absoluteIndex}</td>
                        <td className="dt-mono font-semibold whitespace-nowrap">
                          Frame {group.frameId}
                          {markedInGroup > 0 && (
                            <span className="ml-1.5 rounded bg-[var(--status-danger-subtle)] px-1 py-0.5 text-[10px] text-[var(--status-danger-text)]">
                              −{markedInGroup}
                            </span>
                          )}
                        </td>
                        <td className="hidden max-w-[160px] truncate text-xs text-[var(--text-secondary)] xl:table-cell" title={group.frameName}>
                          {group.frameName}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {uniqueLabels.map((lbl) => (
                              <span
                                key={lbl}
                                className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[10px] font-medium"
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: getLabelColor(lbl, dataset) }}
                                />
                                {lbl}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="dt-mono text-right font-semibold text-[var(--status-danger-text)]">
                          {group.boxes.length}
                        </td>
                        <td className="dt-mono text-right text-xs text-[var(--text-secondary)]">
                          {group.overlapPercentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2">
                {paginatedGroups.map((group, index) => {
                  const isSelected = selectedGroupId === group.id;
                  const absoluteIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <div
                      key={group.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectGroup(group.id)}
                      onKeyDown={(e) => handleRowKeyDown(e, index, group)}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {canDelete && (
                            <button
                              type="button"
                              aria-label={`Chọn nhóm Frame ${group.frameId}`}
                              onClick={(e) => { e.stopPropagation(); onToggleGroup(group.id); }}
                              className="text-[var(--text-muted)] hover:text-[var(--status-danger)]"
                            >
                              {selectedGroupIds.includes(group.id) ? (
                                <Check className="h-3.5 w-3.5 text-[var(--status-danger)]" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <span className="dt-mono text-[11px] text-[var(--text-muted)]">#{absoluteIndex}</span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">Frame {group.frameId}</span>
                        </div>
                        <span className="dt-mono rounded bg-[var(--status-danger-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-danger-text)]">
                          {group.boxes.length} box trùng
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span className="truncate" title={group.frameName}>{group.frameName}</span>
                        <span className="dt-mono shrink-0">IoU {group.overlapPercentage}%</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {Array.from(new Set(group.boxes.map((b) => b.label))).map((lbl) => (
                          <span
                            key={lbl}
                            className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[10px]"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getLabelColor(lbl, dataset) }} />
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <FileCheck className="mb-3 h-10 w-10 text-[var(--status-success)] opacity-80" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Không tìm thấy trùng lặp nào</h4>
              <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary)]">
                {duplicateGroups.length > 0
                  ? 'Không có kết quả khớp với bộ lọc tìm kiếm và nhãn của bạn.'
                  : 'Không có lỗi trùng lặp nào được phát hiện trong file dữ liệu này!'}
              </p>
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="dt-btn dt-btn-secondary dt-btn-sm"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <span className="dt-mono text-xs font-medium text-[var(--text-secondary)]">
              Trang {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="dt-btn dt-btn-secondary dt-btn-sm"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Detail Pane: Dedicated Sticky Quick Visual Inspector */}
      <div className="dt-panel flex min-h-[540px] flex-col overflow-hidden lg:sticky lg:top-0 lg:col-span-6 xl:col-span-6">
        {quickReviewGroup && quickReviewFrameData ? (
          <>
            {/* Inspector Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="dt-mono text-sm font-bold text-[var(--text-primary)]">
                    Frame {quickReviewGroup.frameId}
                  </h4>
                  <span className="dt-mono rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-danger-text)]">
                    IoU {quickReviewGroup.overlapPercentage}%
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]" title={quickReviewGroup.frameName}>
                  {quickReviewGroup.frameName}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {quickViewBox && (
                  <button
                    type="button"
                    onClick={() => setQuickViewBox(null)}
                    className="dt-btn dt-btn-secondary dt-btn-sm"
                  >
                    <RotateCcw className="h-3 w-3" /> Đặt lại
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="dt-btn dt-btn-primary dt-btn-sm"
                >
                  <Eye className="h-3.5 w-3.5" /> Mở kiểm tra chi tiết
                </button>
                {canDelete && onDeleteGroup && (
                  <button
                    type="button"
                    disabled={quickReviewDeleteCount === 0}
                    onClick={() => onDeleteGroup(quickReviewGroup)}
                    className="dt-btn dt-btn-danger dt-btn-sm"
                    title={vi ? 'Xóa các box đã đánh dấu trong nhóm này' : 'Delete marked boxes in this group'}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ({quickReviewDeleteCount})
                  </button>
                )}
              </div>
            </div>

            {/* Quick box mark bar */}
            {canDelete && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Chọn box xóa:</span>
                  {quickReviewGroup.boxes.map((box, boxIndex) => {
                    const markedDelete = selectionByBoxId[box.id] === 'delete';
                    const letter = String.fromCharCode(65 + boxIndex);
                    return (
                      <button
                        key={box.id}
                        type="button"
                        disabled={box.annotationKind === 'track'}
                        aria-pressed={markedDelete}
                        title={markedDelete ? `Box ${letter}: bỏ đánh dấu xóa` : `Box ${letter}: đánh dấu xóa`}
                        onClick={() => onBoxSelection(box.id, markedDelete ? 'keep' : 'delete')}
                        className={`dt-mono min-w-7 rounded border px-2 py-0.5 text-xs font-bold transition-colors disabled:opacity-40 ${
                          markedDelete
                            ? 'border-[var(--status-danger)] bg-[var(--status-danger)] text-white'
                            : 'border-[var(--status-success-border)] bg-[var(--status-success-subtle)] text-[var(--status-success-text)] hover:border-[var(--status-danger)]'
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Cuộn để zoom cạnh box · Chưa chọn = giữ · Đỏ = xóa
                </span>
              </div>
            )}

            {/* Interactive SVG Viewport */}
            <div
              ref={quickReviewRef}
              className="relative h-[320px] w-full select-none bg-[var(--bg-viewport)]"
              title="Cuộn chuột để zoom vào cạnh box"
            >
              {quickReviewImageSrc && activeQuickViewBox ? (
                <svg
                  viewBox={`${activeQuickViewBox.x} ${activeQuickViewBox.y} ${activeQuickViewBox.width} ${activeQuickViewBox.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="absolute inset-0 h-full w-full"
                >
                  <image
                    href={quickReviewImageSrc}
                    x="0"
                    y="0"
                    width={quickReviewSourceWidth}
                    height={quickReviewSourceHeight}
                    preserveAspectRatio="none"
                  />
                  {quickReviewGroup.boxes.map((box, boxIndex) => {
                    const markedDelete = selectionByBoxId[box.id] === 'delete';
                    const color = markedDelete ? '#f43f5e' : getLabelColor(box.label, dataset);
                    const badgeRadius = Math.max(1.5, 4 * quickOverlayScale);
                    const badgeOffset = boxIndex * badgeRadius * 2.4;
                    return (
                      <g
                        key={box.id}
                        className="cursor-pointer"
                        onClick={() => {
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
                          fill={markedDelete ? 'rgba(244, 63, 94, 0.22)' : 'rgba(16, 185, 129, 0.14)'}
                          stroke={color}
                          strokeWidth="3"
                          strokeDasharray={markedDelete ? '8,5' : undefined}
                          vectorEffect="non-scaling-stroke"
                        />
                        <g pointerEvents="none">
                          <circle cx={box.xtl + badgeRadius + badgeOffset} cy={box.ytl + badgeRadius} r={badgeRadius} fill={color} />
                          <text
                            x={box.xtl + badgeRadius + badgeOffset}
                            y={box.ytl + badgeRadius * 1.38}
                            fill="#ffffff"
                            fontSize={Math.max(2, badgeRadius * 1.35)}
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {String.fromCharCode(65 + boxIndex)}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-slate-400">
                  {quickReviewImageLoading
                    ? 'Đang tải ảnh frame…'
                    : (quickReviewImageError || 'Không có ảnh, chỉ hiển thị khung tọa độ')}
                </div>
              )}
            </div>

            {/* Structured Coordinate Comparison Table */}
            <div className="border-t border-[var(--border-subtle)] overflow-x-auto">
              <table className="dt-table">
                <thead>
                  <tr>
                    <th className="w-10">Box</th>
                    <th>ID</th>
                    <th>{vi ? 'Nhãn' : 'Label'}</th>
                    <th>{vi ? 'Tọa độ [xtl, ytl, xbr, ybr]' : 'Coords [xtl, ytl, xbr, ybr]'}</th>
                    {canDelete && <th className="text-right">{vi ? 'Thao tác' : 'Action'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {quickReviewGroup.boxes.map((box, boxIndex) => {
                    const markedDelete = selectionByBoxId[box.id] === 'delete';
                    const letter = String.fromCharCode(65 + boxIndex);
                    return (
                      <tr key={box.id}>
                        <td>
                          <span
                            className={`dt-mono inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${
                              markedDelete
                                ? 'bg-[var(--status-danger)] text-white'
                                : 'bg-[var(--status-success-subtle)] text-[var(--status-success-text)]'
                            }`}
                          >
                            {letter}
                          </span>
                        </td>
                        <td className="dt-mono text-xs text-[var(--text-secondary)]">
                          #{box.globalIndex}
                          {box.trackId && (
                            <span className="ml-1 rounded bg-[var(--status-purple-subtle)] px-1 py-0.5 text-[10px] text-[var(--status-purple)]">
                              T{box.trackId}
                            </span>
                          )}
                        </td>
                        <td className="text-xs font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: getLabelColor(box.label, dataset) }}
                            />
                            {box.label}
                          </span>
                        </td>
                        <td className="dt-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                          [{box.xtl.toFixed(1)}, {box.ytl.toFixed(1)}, {box.xbr.toFixed(1)}, {box.ybr.toFixed(1)}]
                        </td>
                        {canDelete && (
                          <td className="text-right">
                            <button
                              type="button"
                              disabled={box.annotationKind === 'track'}
                              onClick={() => onBoxSelection(box.id, markedDelete ? 'keep' : 'delete')}
                              className={`dt-btn dt-btn-sm h-6 px-2 text-[11px] ${
                                markedDelete ? 'dt-btn-danger' : 'dt-btn-secondary'
                              }`}
                            >
                              {markedDelete ? 'Bỏ xóa' : 'Xóa'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Layers className="mb-3 h-10 w-10 text-[var(--text-muted)] opacity-60" />
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              Chọn một tệp trùng lặp bên trái
            </h4>
            <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary)]">
              Nhấp chọn bất kỳ cặp trùng lặp nào trong danh mục bên trái để soi tọa độ cận cảnh trực quan.
            </p>
            {paginatedGroups.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectGroup(paginatedGroups[0].id)}
                className="dt-btn dt-btn-primary dt-btn-sm mt-4"
              >
                {vi ? `Soi nhóm đầu tiên (Frame ${paginatedGroups[0].frameId})` : `Inspect first group (Frame ${paginatedGroups[0].frameId})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
