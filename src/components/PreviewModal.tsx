import { useState, useRef } from 'react';
import {
  Layers,
  X,
  Maximize2,
  Eye,
  Loader2
} from 'lucide-react';
import CustomZoomPanPinch, { type ZoomState } from './CustomZoomPanPinch';
import { type CVATDataset, type CVATFrameData, type DuplicateGroup } from '../types';
import { getLabelColor } from '../constants/colors';

interface PreviewModalProps {
  selectedGroup: DuplicateGroup;
  selectedFrameData: CVATFrameData;
  dataset: CVATDataset;
  duplicateGroups: DuplicateGroup[];
  currentImageSrc: string | null;
  imageLoading: boolean;
  customZoomPadding: number;
  onCustomZoomPaddingChange: (value: number) => void;
  onClose: () => void;
}

export default function PreviewModal({
  selectedGroup,
  selectedFrameData,
  dataset,
  duplicateGroups,
  currentImageSrc,
  imageLoading,
  customZoomPadding,
  onCustomZoomPaddingChange,
  onClose
}: PreviewModalProps) {
  const [, setHoveredBoxId] = useState<string | null>(null);
  const transformComponentRef = useRef<any>(null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-950/80 backdrop-blur-sm">
      <div
        className="w-full h-full max-w-7xl flex flex-col relative bg-white rounded-3xl shadow-2xl overflow-hidden animate-[modalIn_0.2s_ease-out_both]"
      >

        {/* Right Column: Visual Inspector & Comparison table */}
        <div className="flex flex-col flex-1 h-full max-h-full">

          {/* SVG Visual Canvas Box */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col flex-1 overflow-hidden">

            {/* Canvas header controls */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <Eye className="w-4.5 h-4.5 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                  {selectedFrameData
                    ? `Preview: Frame ${selectedFrameData.id}`
                    : 'Preview'
                  }
                </h3>
              </div>

              <div className="flex items-center space-x-3">
                {selectedFrameData && (
                  <div className="flex items-center space-x-2">
                    {/* Zoom to duplicates toggle with dynamic padding slider */}
                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => {
                          if (transformComponentRef.current) {
                            transformComponentRef.current.zoomToElement('duplicate-group-bounds', undefined, 800, 'easeOut');
                          }
                        }}
                        className="p-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1 bg-white text-blue-700 shadow-2xs border border-slate-200 hover:bg-slate-50"
                        title="Di chuyển đến vị trí lỗi trên ảnh"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Đến vị trí lỗi</span>
                      </button>
                      <div className="flex items-center space-x-1 pl-1.5 border-l border-slate-200">
                        <input
                          type="range"
                          min="10"
                          max="400"
                          step="5"
                          value={customZoomPadding}
                          onChange={(e) => onCustomZoomPaddingChange(parseInt(e.target.value, 10))}
                          className="w-12 sm:w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          title="Kéo về trái để zoom siêu gần sát đối tượng nhỏ (giảm khoảng đệm)"
                        />
                        <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-slate-600 w-11 text-right" title="Khoảng cách lề bao quanh đối tượng (px). Càng nhỏ thì zoom càng cận!">
                          &plusmn;{customZoomPadding}px
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                  title="Đóng Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SVG drawing viewport */}
            <div className="flex-1 bg-slate-950 relative flex items-center justify-center p-4 min-h-[300px]">
              {selectedFrameData && selectedGroup ? (
                <div className="w-full h-full flex flex-col justify-between items-center absolute inset-0 p-4">

                  {/* Coordinate indicator */}
                  <div className="self-start flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800 backdrop-blur-xs z-10">
                    <span>Kích thước: {selectedFrameData.width} &times; {selectedFrameData.height} px</span>
                    <span className="text-slate-600">|</span>
                    {currentImageSrc ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-sans font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Đã tải ảnh thực tế từ ZIP
                      </span>
                    ) : (
                      <span className="text-slate-500 font-sans">Chỉ có file XML (Vẽ mô phỏng)</span>
                    )}
                  </div>

                  {/* Responsive SVG Container */}
                  <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
                    {imageLoading && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center z-20">
                        <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
                        <p className="text-xs text-slate-300 font-bold font-sans">Đang giải nén ảnh...</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono truncate max-w-xs">Frame {selectedFrameData.id}</p>
                      </div>
                    )}

                    <CustomZoomPanPinch
      contentWidth={selectedFrameData.width}
      contentHeight={selectedFrameData.height}
      onZoomToElementRef={transformComponentRef}
    >

                      {({ state }: { state: ZoomState }) => {
                        const currentScale = state.scale || 1;
                        const dynamicStrokeWidth = (1.5 / currentScale).toString();
                        const dynamicHighlightStrokeWidth = (2 / currentScale).toString();
                        const labelScale = Math.min(1, 1 / currentScale * 2);

                        // Find all duplicate groups for this frame
                        const frameDuplicateGroups = duplicateGroups.filter(g => g.frameId === selectedFrameData.id);
                        const frameDuplicateBoxIds = new Set(frameDuplicateGroups.flatMap(g => g.boxes.map(b => b.id)));
                        const allDuplicateBoxesInFrame = selectedFrameData.boxes.filter(b => frameDuplicateBoxIds.has(b.id));

                        return (

                          <svg
                            viewBox={`0 0 ${selectedFrameData.width} ${selectedFrameData.height}`}
                            className="w-full h-full border border-slate-800 shadow-2xl"
                          >
                        {/* Background drawing (Image or solid dark color) */}
                        {currentImageSrc ? (
                          <image
                            href={currentImageSrc}
                            width={selectedFrameData.width}
                            height={selectedFrameData.height}

                            preserveAspectRatio="none"
                          />
                        ) : (
                          <rect
                            width={selectedFrameData.width}
                            height={selectedFrameData.height}
                            fill="#090d16"
                          />
                        )}

                        {selectedGroup && selectedFrameData && selectedGroup.boxes.length > 0 && (
                          <foreignObject id="duplicate-group-bounds"
                            x={Math.max(0, Math.min(...selectedGroup.boxes.map(b => b.xtl)) - customZoomPadding)}
                            y={Math.max(0, Math.min(...selectedGroup.boxes.map(b => b.ytl)) - customZoomPadding)}
                            width={Math.max(0, Math.max(...selectedGroup.boxes.map(b => b.xbr)) - Math.min(...selectedGroup.boxes.map(b => b.xtl)) + customZoomPadding * 2)}
                            height={Math.max(0, Math.max(...selectedGroup.boxes.map(b => b.ybr)) - Math.min(...selectedGroup.boxes.map(b => b.ytl)) + customZoomPadding * 2)}
                            pointerEvents="none"
                          >
                            <div style={{ width: '100%', height: '100%' }}></div>
                          </foreignObject>
                        )}

                        {/* DRAW ALL OTHER BOXES on this frame (Non-duplicates) */}
                        {selectedFrameData.boxes
                          .filter(b => !frameDuplicateBoxIds.has(b.id))
                          .map(box => (
                            <g key={box.id} className="opacity-30">
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

                        {/* DRAW ALL DUPLICATE BOX GROUPS in this frame (High contrast highlighted) */}
                        {allDuplicateBoxesInFrame.map((box, idx) => {
                          const isFirst = idx % 2 === 0;

                          // Highlight duplicate group only; app no longer marks keep/delete boxes.
                          const color = getLabelColor(box.label, dataset);
                          const strokeWidth = dynamicHighlightStrokeWidth;

                          return (
                            <g
                              key={box.id}
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setHoveredBoxId(box.id)}
                              onMouseLeave={() => setHoveredBoxId(null)}
                            >
                              {/* Bounding box rect */}
                              <rect
                                x={box.xtl}
                                y={box.ytl}
                                width={box.xbr - box.xtl}
                                height={box.ybr - box.ytl}
                                fill={color + "1a"}
                                stroke={color}
                                strokeWidth={strokeWidth}
                                vectorEffect="non-scaling-stroke"
                                style={{ transition: 'stroke-width 0.15s ease' }}
                              />

                              {/* Small label badge at top-left of box */}
                              <g style={{ transform: `scale(${labelScale})`, transformOrigin: `${box.xtl}px ${box.ytl}px` }}>
                                <rect
                                  x={box.xtl}
                                  y={box.ytl - (isFirst ? 18 : 34)}
                                  width={Math.max((box.label.length * 7) + 30, 95)}
                                  height="16"
                                  fill={color}
                                  rx="2"
                                />

                                <text
                                  x={box.xtl + 5}
                                  y={box.ytl - (isFirst ? 6 : 22)}
                                  fill="#ffffff"
                                  fontSize="9.5"
                                  fontWeight="black"
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

                  {/* Visual label note & manual image uploader removed */}

                </div>
              ) : (
                <div className="text-center p-10 flex flex-col items-center justify-center max-w-sm text-slate-500">
                  <Layers className="w-16 h-16 text-slate-800 mb-4 animate-pulse" />
                  <h4 className="font-bold text-sm text-slate-300">Chọn một tệp trùng lặp bên trái</h4>
                  <p className="text-xs text-slate-500 mt-2">
                    Nhấp chọn bất kỳ cặp trùng lặp nào trong danh mục bên trái để soi tọa độ cận cảnh trực quan.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Phần bảng chi tiết đã được xoá theo yêu cầu để nhường không gian cho Canvas SVG */}

        </div>
      </div>
    </div>
  );
}
