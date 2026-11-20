import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers,
  X,
  Target,
  Eye,
  EyeOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import CustomZoomPanPinch, { type ZoomControls, type ZoomState } from './CustomZoomPanPinch';
import { type CVATDataset, type CVATFrameData, type DuplicateGroup, type DuplicateSelection } from '../types';
import { getLabelColor } from '../constants/colors';
import { useLocale } from '../i18n/LocaleProvider';

interface PreviewModalProps {
  selectedGroup: DuplicateGroup;
  selectedFrameData: CVATFrameData;
  dataset: CVATDataset;
  duplicateGroups: DuplicateGroup[];
  currentImageSrc: string | null;
  imageLoading: boolean;
  imageError: string | null;
  imageDimensions: { width: number; height: number } | null;
  customZoomPadding: number;
  onCustomZoomPaddingChange: (value: number) => void;
  selectionByBoxId: Record<string, DuplicateSelection>;
  onBoxSelection: (boxId: string, selection: DuplicateSelection) => void;
  canDelete: boolean;
  onDelete: () => void;
  onPrevGroup?: () => void;
  onNextGroup?: () => void;
  groupPosition?: { index: number; total: number };
  onClose: () => void;
}

export default function PreviewModal({
  selectedGroup,
  selectedFrameData,
  dataset,
  duplicateGroups,
  currentImageSrc,
  imageLoading,
  imageError,
  imageDimensions,
  customZoomPadding,
  onCustomZoomPaddingChange,
  selectionByBoxId,
  onBoxSelection,
  canDelete,
  onDelete,
  onPrevGroup,
  onNextGroup,
  groupPosition,
  onClose,
}: PreviewModalProps) {
  const { locale } = useLocale();
  const vi = locale === 'vi';
  const transformComponentRef = useRef<ZoomControls | null>(null);
  const [hiddenBoxIds, setHiddenBoxIds] = useState<string[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const imageWidth = imageDimensions?.width ?? selectedFrameData.width;
  const imageHeight = imageDimensions?.height ?? selectedFrameData.height;

  useEffect(() => {
    setHiddenBoxIds([]);
  }, [selectedGroup.id]);

  const frameDuplicateBoxIds = useMemo(() => {
    const ids = duplicateGroups
      .filter((group) => group.frameId === selectedFrameData.id)
      .flatMap((group) => group.boxes.map((box) => box.id));
    return new Set(ids);
  }, [duplicateGroups, selectedFrameData.id]);

  const regularBoxes = useMemo(
    () => selectedFrameData.boxes.filter((box) => !frameDuplicateBoxIds.has(box.id)),
    [selectedFrameData.boxes, frameDuplicateBoxIds],
  );

  const duplicateBoxes = useMemo(
    () => selectedFrameData.boxes.filter((box) => frameDuplicateBoxIds.has(box.id) && !hiddenBoxIds.includes(box.id)),
    [selectedFrameData.boxes, frameDuplicateBoxIds, hiddenBoxIds],
  );

  const groupDeleteCount = selectedGroup.boxes.filter((box) => selectionByBoxId[box.id] === 'delete').length;

  const selectedGroupBounds = useMemo(() => {
    if (selectedGroup.boxes.length === 0) return null;
    const minX = Math.min(...selectedGroup.boxes.map((box) => box.xtl));
    const minY = Math.min(...selectedGroup.boxes.map((box) => box.ytl));
    const maxX = Math.max(...selectedGroup.boxes.map((box) => box.xbr));
    const maxY = Math.max(...selectedGroup.boxes.map((box) => box.ybr));

    return {
      x: Math.max(0, minX - customZoomPadding),
      y: Math.max(0, minY - customZoomPadding),
      width: Math.max(0, maxX - minX + customZoomPadding * 2),
      height: Math.max(0, maxY - minY + customZoomPadding * 2),
    };
  }, [selectedGroup.boxes, customZoomPadding]);

  const zoomToIssue = () => {
    transformComponentRef.current?.zoomToElement('duplicate-group-bounds', undefined, 500, 'easeOut');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft' && onPrevGroup) {
        event.preventDefault();
        onPrevGroup();
      } else if (event.key === 'ArrowRight' && onNextGroup) {
        event.preventDefault();
        onNextGroup();
      } else if (event.key.toLowerCase() === 'g') {
        event.preventDefault();
        zoomToIssue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevGroup, onNextGroup]);

  return (
    <div
      className="app-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview Frame ${selectedFrameData.id}`}
    >
      <div className="app-modal flex h-full w-full max-w-[96vw] flex-col overflow-hidden rounded-xl animate-[modalIn_0.16s_ease-out_both]">
        {/* Modal Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <Eye className="h-4 w-4 text-[var(--accent-primary)]" />
            <h3 className="dt-mono text-sm font-bold text-[var(--text-primary)]">
              Preview: Frame {selectedFrameData.id}
            </h3>
            <span className="hidden md:inline max-w-[240px] truncate text-xs text-[var(--text-secondary)]" title={selectedFrameData.name}>
              {selectedFrameData.name}
            </span>
            {groupPosition && (
              <div className="ml-1 inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
                <button
                  type="button"
                  disabled={!onPrevGroup}
                  onClick={onPrevGroup}
                  className="dt-icon-btn h-6 w-6"
                  title={vi ? 'Nhóm trước (←)' : 'Previous group (←)'}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="dt-mono px-1.5 text-[11px] text-[var(--text-secondary)]">
                  {groupPosition.index} / {groupPosition.total}
                </span>
                <button
                  type="button"
                  disabled={!onNextGroup}
                  onClick={onNextGroup}
                  className="dt-icon-btn h-6 w-6"
                  title={vi ? 'Nhóm tiếp (→)' : 'Next group (→)'}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Zoom to issue + padding control */}
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1">
              <button
                type="button"
                onClick={zoomToIssue}
                className="dt-btn dt-btn-secondary dt-btn-sm h-6 px-2"
                title="Di chuyển đến vị trí lỗi trên ảnh (G)"
              >
                <Target className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Đến vị trí lỗi</span>
              </button>
              <div className="flex items-center gap-1.5 border-l border-[var(--border-subtle)] pl-2">
                <input
                  type="range"
                  min="10"
                  max="400"
                  step="5"
                  value={customZoomPadding}
                  onChange={(e) => onCustomZoomPaddingChange(parseInt(e.target.value, 10))}
                  className="dt-range w-16 sm:w-20"
                  title="Kéo về trái để zoom siêu gần sát đối tượng nhỏ (giảm khoảng đệm)"
                />
                <span
                  className="dt-mono w-12 text-right text-[11px] font-semibold text-[var(--text-secondary)]"
                  title="Khoảng cách lề bao quanh đối tượng (px). Càng nhỏ thì zoom càng cận!"
                >
                  &plusmn;{customZoomPadding}px
                </span>
              </div>
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={groupDeleteCount === 0}
                className="dt-btn dt-btn-danger dt-btn-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa box đã chọn ({groupDeleteCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => setInspectorOpen((v) => !v)}
              className="dt-icon-btn border border-[var(--border-subtle)]"
              title={inspectorOpen ? (vi ? 'Ẩn thanh kiểm tra' : 'Hide inspector') : (vi ? 'Hiện thanh kiểm tra' : 'Show inspector')}
            >
              {inspectorOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="dt-icon-btn border border-[var(--border-subtle)]"
              title="Đóng Preview (Esc)"
              aria-label="Đóng Preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Workspace: Canvas + Dedicated Right Inspector Rail */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* SVG Viewport */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[var(--bg-viewport)]">
            {/* Coordinate & Image Source HUD */}
            <div className="dt-mono absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-md border border-slate-700/80 bg-slate-950/85 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur-xs">
              <span>Kích thước: {imageWidth} &times; {imageHeight} px</span>
              <span className="text-slate-600">|</span>
              {currentImageSrc ? (
                <span className="flex items-center gap-1.5 font-sans font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Đã tải ảnh thực tế
                </span>
              ) : (
                <span className="font-sans text-slate-400">Chỉ có file XML (Vẽ mô phỏng)</span>
              )}
            </div>

            {selectedFrameData && selectedGroup ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                {imageLoading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-xs">
                    <Loader2 className="mb-2 h-7 w-7 animate-spin text-[var(--accent-primary)]" />
                    <p className="text-xs font-semibold text-slate-200">Đang tải ảnh...</p>
                    <p className="dt-mono mt-0.5 text-[11px] text-slate-400">Frame {selectedFrameData.id}</p>
                  </div>
                )}

                {imageError && !imageLoading && (
                  <div className="absolute bottom-3 left-1/2 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-center text-xs font-medium text-rose-200 shadow-lg">
                    {imageError}
                  </div>
                )}

                <CustomZoomPanPinch
                  contentWidth={imageWidth}
                  contentHeight={imageHeight}
                  onZoomToElementRef={transformComponentRef}
                >
                  {({ state }: { state: ZoomState }) => {
                    const currentScale = state.scale || 1;
                    const dynamicStrokeWidth = (1.5 / currentScale).toString();
                    const dynamicHighlightStrokeWidth = (2 / currentScale).toString();
                    const labelScale = Math.min(1, (1 / currentScale) * 2);

                    return (
                      <svg
                        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                        className="h-full w-full border border-slate-800 shadow-2xl"
                      >
                        {currentImageSrc ? (
                          <image
                            href={currentImageSrc}
                            width={imageWidth}
                            height={imageHeight}
                            preserveAspectRatio="none"
                          />
                        ) : (
                          <rect width={imageWidth} height={imageHeight} fill="#090d16" />
                        )}

                        {selectedGroupBounds && (
                          <foreignObject
                            id="duplicate-group-bounds"
                            x={selectedGroupBounds.x}
                            y={selectedGroupBounds.y}
                            width={selectedGroupBounds.width}
                            height={selectedGroupBounds.height}
                            pointerEvents="none"
                          >
                            <div style={{ width: '100%', height: '100%' }} />
                          </foreignObject>
                        )}

                        {/* Regular non-duplicate boxes */}
                        {regularBoxes.map((box) => (
                          <g key={box.id} className="opacity-35">
                            <rect
                              x={box.xtl}
                              y={box.ytl}
                              width={box.xbr - box.xtl}
                              height={box.ybr - box.ytl}
                              fill="none"
                              stroke={getLabelColor(box.label, dataset)}
                              strokeWidth={dynamicStrokeWidth}
                              vectorEffect="non-scaling-stroke"
                              strokeDasharray="4,4"
                            />
                            <g style={{ transform: `scale(${labelScale})`, transformOrigin: `${box.xtl}px ${box.ytl}px` }}>
                              <text
                                x={box.xtl + 4}
                                y={box.ytl + 12}
                                fill="#94a3b8"
                                fontSize="10"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {box.label}
                              </text>
                            </g>
                          </g>
                        ))}

                        {/* Duplicate boxes */}
                        {duplicateBoxes.map((box, idx) => {
                          const isFirst = idx % 2 === 0;
                          const status = selectionByBoxId[box.id] === 'delete' ? 'delete' : 'keep';
                          const color = getLabelColor(box.label, dataset);

                          return (
                            <g
                              key={box.id}
                              className="cursor-pointer"
                              onClick={() =>
                                canDelete &&
                                box.annotationKind !== 'track' &&
                                onBoxSelection(box.id, status === 'delete' ? 'keep' : 'delete')
                              }
                            >
                              <rect
                                x={box.xtl}
                                y={box.ytl}
                                width={box.xbr - box.xtl}
                                height={box.ybr - box.ytl}
                                fill={status === 'delete' ? '#f43f5e33' : '#10b98126'}
                                stroke={status === 'delete' ? '#f43f5e' : '#10b981'}
                                strokeDasharray={status === 'delete' ? '8,5' : undefined}
                                strokeWidth={dynamicHighlightStrokeWidth}
                                vectorEffect="non-scaling-stroke"
                              />
                              <g style={{ transform: `scale(${labelScale})`, transformOrigin: `${box.xtl}px ${box.ytl}px` }}>
                                <rect
                                  x={box.xtl}
                                  y={box.ytl - (isFirst ? 18 : 34)}
                                  width={Math.max(box.label.length * 7 + 30, 95)}
                                  height="16"
                                  fill={color}
                                  rx="2"
                                />
                                <text
                                  x={box.xtl + 5}
                                  y={box.ytl - (isFirst ? 6 : 22)}
                                  fill="#ffffff"
                                  fontSize="9.5"
                                  fontWeight="700"
                                  fontFamily="sans-serif"
                                >
                                  #{box.globalIndex} {box.label}
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  }}
                </CustomZoomPanPinch>
              </div>
            ) : (
              <div className="flex max-w-sm flex-col items-center justify-center p-10 text-center text-slate-400">
                <Layers className="mb-3 h-12 w-12 opacity-60" />
                <h4 className="text-sm font-semibold text-slate-200">Chọn một tệp trùng lặp bên trái</h4>
                <p className="mt-1 text-xs text-slate-400">
                  Nhấp chọn bất kỳ cặp trùng lặp nào trong danh mục bên trái để soi tọa độ cận cảnh trực quan.
                </p>
              </div>
            )}
          </div>

          {/* Dedicated Right Inspector Rail (never obscures canvas!) */}
          {inspectorOpen && (
            <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3.5 py-2.5">
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  {vi ? `Các box trong nhóm (${selectedGroup.boxes.length})` : `Boxes in group (${selectedGroup.boxes.length})`}
                </h4>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  Mặc định giữ; chỉ chọn box cần xóa
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {selectedGroup.boxes.map((box, index) => {
                  const status = selectionByBoxId[box.id] === 'delete' ? 'delete' : 'keep';
                  const isHidden = hiddenBoxIds.includes(box.id);
                  const letter = String.fromCharCode(65 + index);

                  return (
                    <div
                      key={box.id}
                      className={`rounded-lg border p-2.5 text-xs ${
                        status === 'delete'
                          ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`dt-mono inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                              status === 'delete'
                                ? 'bg-[var(--status-danger)] text-white'
                                : 'bg-[var(--status-success-subtle)] text-[var(--status-success-text)]'
                            }`}
                          >
                            {letter}
                          </span>
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: getLabelColor(box.label, dataset) }}
                          />
                          <span className="truncate font-semibold text-[var(--text-primary)]">{box.label}</span>
                        </div>
                        <span className="dt-mono text-[11px] text-[var(--text-muted)]">#{box.globalIndex}</span>
                      </div>

                      <p className="dt-mono mt-1.5 text-[11px] text-[var(--text-secondary)]">
                        [{box.xtl.toFixed(1)}, {box.ytl.toFixed(1)}, {box.xbr.toFixed(1)}, {box.ybr.toFixed(1)}]
                      </p>

                      <div className="mt-2 flex items-center gap-1.5">
                        {canDelete && (
                          <button
                            type="button"
                            disabled={box.annotationKind === 'track'}
                            onClick={() => onBoxSelection(box.id, status === 'delete' ? 'keep' : 'delete')}
                            className={`dt-btn dt-btn-sm h-7 flex-1 ${
                              status === 'delete' ? 'dt-btn-danger' : 'dt-btn-secondary'
                            }`}
                          >
                            {status === 'delete' ? 'Bỏ xóa' : 'Xóa'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setHiddenBoxIds((ids) =>
                              ids.includes(box.id) ? ids.filter((id) => id !== box.id) : [...ids, box.id],
                            )
                          }
                          className="dt-btn dt-btn-ghost dt-btn-sm h-7 border border-[var(--border-subtle)] px-2"
                          title={isHidden ? 'Hiện' : 'Ẩn'}
                        >
                          {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <span>{isHidden ? 'Hiện' : 'Ẩn'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3.5 py-2.5 text-[11px] text-[var(--text-muted)] space-y-1">
                <div className="font-semibold text-[var(--text-secondary)]">{vi ? 'Phím tắt' : 'Shortcuts'}</div>
                <div className="dt-mono">G — {vi ? 'Đến vị trí lỗi' : 'Go to issue'}</div>
                <div className="dt-mono">← / → — {vi ? 'Chuyển nhóm' : 'Prev / Next'}</div>
                <div className="dt-mono">Esc — {vi ? 'Đóng' : 'Close'}</div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
