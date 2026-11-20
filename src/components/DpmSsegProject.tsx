import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw, ScanSearch } from 'lucide-react';
import type { CVATBox, CVATDataset, CVATFrameData } from '../types';
import type { MaskFrame, MaskOverlapPair } from '../utils/maskOverlap';
import { getMaskSpans } from '../utils/maskOverlap';
import type { Locale } from '../i18n/LocaleProvider';
import { useFrameImage, type CvatFrameSource } from '../hooks/useFrameImage';
import type { Entry } from '@zip.js/zip.js';
import { getLabelColor } from '../constants/colors';

export function DpmSsegProject({ dataset, locale, zipEntries, manualImages, cvatFrameSource }: {
  dataset: CVATDataset | null;
  locale: Locale;
  zipEntries: Entry[] | null;
  manualImages: Record<string, string>;
  cvatFrameSource: CvatFrameSource | null;
}) {
  const en = locale === 'en';
  const bounds = useMemo(() => {
    const ids = (dataset?.frames ?? []).map((frame) => Number(frame.id)).filter(Number.isFinite);
    return ids.length ? { min: Math.min(...ids), max: Math.max(...ids) } : { min: 0, max: 0 };
  }, [dataset]);

  const [start, setStart] = useState<number | ''>('');
  const [end, setEnd] = useState<number | ''>('');
  const [threshold, setThreshold] = useState(10);
  const [scanMode, setScanMode] = useState<'both' | 'pixels' | 'percent'>('both');
  const [sameLabelOnly, setSameLabelOnly] = useState(false);
  const [minSharedPixels, setMinSharedPixels] = useState(10);
  const [scanRequest, setScanRequest] = useState<{ frames: MaskFrame[]; threshold: number; minIntersectionPixels: number; sameLabelOnly: boolean } | null>(null);
  const [results, setResults] = useState<MaskOverlapPair[] | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPairKey, setSelectedPairKey] = useState('');
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState({ scale: 1, x: 0, y: 0 });

  const from = start === '' ? bounds.min : start;
  const to = end === '' ? bounds.max : end;
  const frames = useMemo(() => (dataset?.frames ?? []).filter((frame) => Number(frame.id) >= from && Number(frame.id) <= to), [dataset, from, to]);
  const maskCount = useMemo(() => frames.reduce((sum, frame) => sum + frame.boxes.filter((box) => box.shapeType === 'mask' && !box.outside).length, 0), [frames]);
  const pairKey = (pair: MaskOverlapPair) => `${pair.frameId}:${pair.first.id}:${pair.second.id}`;
  const selectedPair = results?.find((pair) => pairKey(pair) === selectedPairKey) ?? results?.[0] ?? null;
  const previewFrame: CVATFrameData | null = selectedPair ? dataset?.frames.find((frame) => frame.id === selectedPair.frameId) ?? null : null;
  const previewMaskA: CVATBox | undefined = previewFrame?.boxes.find((box) => box.id === selectedPair?.first.id);
  const previewMaskB: CVATBox | undefined = previewFrame?.boxes.find((box) => box.id === selectedPair?.second.id);
  const preview = useFrameImage({ selectedFrameData: previewFrame, zipEntries, manualImages, cvatFrameSource });

  useEffect(() => {
    if (!selectedPair || !previewFrame) return;
    setSelectedPairKey(pairKey(selectedPair));
  }, [selectedPair?.frameId, selectedPair?.first.id, selectedPair?.second.id]);

  useEffect(() => {
    setPreviewZoom({ scale: 1, x: 0, y: 0 });
  }, [selectedPair?.frameId, selectedPair?.first.id, selectedPair?.second.id]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    const zoomPreviewAtPointer = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const current = previewZoom;
      const scale = Math.max(1, Math.min(8, current.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2)));
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const x = pointerX - (pointerX - current.x) / current.scale * scale;
      const y = pointerY - (pointerY - current.y) / current.scale * scale;
      setPreviewZoom({
        scale,
        x: Math.min(0, Math.max(rect.width * (1 - scale), x)),
        y: Math.min(0, Math.max(rect.height * (1 - scale), y)),
      });
    };
    viewport.addEventListener('wheel', zoomPreviewAtPointer, { passive: false });
    return () => viewport.removeEventListener('wheel', zoomPreviewAtPointer);
  }, [previewFrame, previewZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewFrame || !previewMaskA || !previewMaskB) return;
    const width = Math.max(1, Math.round(preview.imageDimensions?.width ?? previewFrame.width));
    const height = Math.max(1, Math.round(preview.imageDimensions?.height ?? previewFrame.height));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const drawSolidMask = (box: CVATBox, color: string) => {
      context.save();
      context.globalAlpha = 0.5;
      context.fillStyle = color;
      for (const span of getMaskSpans(box, { width, height })) context.fillRect(span.x1, span.y, span.x2 - span.x1, 1);
      context.restore();
    };
    drawSolidMask(previewMaskB, getLabelColor(previewMaskB.label, dataset));
    const hatchSpans = getMaskSpans(previewMaskA, { width, height });
    const hatchPath = new Path2D();
    for (const span of hatchSpans) hatchPath.rect(span.x1, span.y, span.x2 - span.x1, 1);
    context.save();
    context.clip(hatchPath);
    context.strokeStyle = 'rgba(255,255,255,0.95)';
    context.lineWidth = Math.max(1.5, width / 1200);
    const spacing = Math.max(8, width / 160);
    for (let x = -height; x < width + height; x += spacing) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + height, height);
      context.stroke();
    }
    context.restore();
  }, [selectedPair, previewFrame, previewMaskA, previewMaskB, preview.imageDimensions, dataset]);

  useEffect(() => {
    if (!scanRequest) return;
    const worker = new Worker(new URL('../workers/maskOverlap.worker.ts', import.meta.url), { type: 'module' });
    setIsScanning(true);
    setScanError('');
    worker.onmessage = (event: MessageEvent<{ type: string; completed?: number; total?: number; pairs?: MaskOverlapPair[]; message?: string }>) => {
      if (event.data.type === 'progress') setProgress({ completed: event.data.completed ?? 0, total: event.data.total ?? 0 });
      if (event.data.type === 'done') { setResults(event.data.pairs ?? []); setIsScanning(false); worker.terminate(); }
      if (event.data.type === 'error') { setScanError(event.data.message ?? 'Không thể giải mã mask.'); setIsScanning(false); worker.terminate(); }
    };
    worker.onerror = () => { setScanError(en ? 'Mask scan failed.' : 'Quét mask thất bại.'); setIsScanning(false); worker.terminate(); };
    worker.postMessage(scanRequest);
    return () => worker.terminate();
  }, [scanRequest, en]);

  const invalidateResults = () => {
    setScanRequest(null);
    setResults(null);
    setSelectedPairKey('');
    setScanError('');
    setIsScanning(false);
    setProgress({ completed: 0, total: 0 });
  };

  const runScan = () => {
    if (!frames.length) return;
    const maskFrames: MaskFrame[] = frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height,
      boxes: frame.boxes
        .filter((box) => box.shapeType === 'mask' && !box.outside)
        .map((box) => ({
          id: box.id,
          label: box.label,
          xtl: box.xtl,
          ytl: box.ytl,
          xbr: box.xbr,
          ybr: box.ybr,
          maskRle: box.maskRle,
        })),
    }));
    setResults(null);
    setSelectedPairKey('');
    setScanError('');
    setProgress({ completed: 0, total: maskFrames.length });
    setScanRequest({
      frames: maskFrames,
      threshold: scanMode === 'pixels' ? 0 : threshold,
      minIntersectionPixels: scanMode === 'percent' ? 1 : minSharedPixels,
      sameLabelOnly,
    });
  };

  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <section className="flex flex-col gap-3">
      {/* Header + Scan Controls */}
      <div className="dt-panel overflow-hidden">
        <div className="dt-panel-header bg-[var(--bg-surface-elevated)]">
          <div>
            <span className="dt-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-text)]">
              PROJECT / DPM · SSEG
            </span>
            <h1 className="text-base font-bold text-[var(--text-primary)]">
              {en ? 'Mask overlap check' : 'Kiểm tra chồng lấn mask'}
            </h1>
          </div>
          <div className="dt-mono text-xs text-[var(--text-secondary)]" role="status">
            {isScanning
              ? en
                ? `Scanning ${progress.completed}/${progress.total} frames…`
                : `Đang quét ${progress.completed}/${progress.total} frame…`
              : results === null
                ? en
                  ? `${frames.length.toLocaleString()} frames · ${maskCount.toLocaleString()} masks`
                  : `${frames.length.toLocaleString()} frame · ${maskCount.toLocaleString()} mask`
                : en
                  ? `${results.length.toLocaleString()} overlapping pairs`
                  : `${results.length.toLocaleString()} cặp mask bị chồng lấn`}
          </div>
        </div>

        {!dataset ? (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
            {en ? 'Open a dataset in the Home tab first.' : 'Hãy mở dataset ở Trang chính trước.'}
          </div>
        ) : (
          <div className="space-y-3 p-3.5">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* Frame range group */}
              <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-2.5 py-1.5">
                <span className="dt-mono text-[11px] font-medium text-[var(--text-secondary)]">
                  Frame {bounds.min}–{bounds.max}
                </span>
                <input
                  aria-label={en ? 'Start frame' : 'Frame bắt đầu'}
                  type="number"
                  min={bounds.min}
                  max={bounds.max}
                  value={start}
                  placeholder={String(bounds.min)}
                  onChange={(event) => {
                    setStart(event.target.value === '' ? '' : Number(event.target.value));
                    invalidateResults();
                  }}
                  className="dt-input dt-input-sm dt-mono w-20"
                />
                <span className="text-[var(--text-muted)]">→</span>
                <input
                  aria-label={en ? 'End frame' : 'Frame kết thúc'}
                  type="number"
                  min={bounds.min}
                  max={bounds.max}
                  value={end}
                  placeholder={String(bounds.max)}
                  onChange={(event) => {
                    setEnd(event.target.value === '' ? '' : Number(event.target.value));
                    invalidateResults();
                  }}
                  className="dt-input dt-input-sm dt-mono w-20"
                />
              </div>

              {/* Scan mode & thresholds */}
              <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="font-medium">{en ? 'Scan by' : 'Quét theo'}</span>
                <select
                  className="dt-select dt-select-sm"
                  value={scanMode}
                  onChange={(event) => {
                    setScanMode(event.target.value as typeof scanMode);
                    invalidateResults();
                  }}
                >
                  <option value="both">{en ? 'Both conditions' : 'Cả hai điều kiện'}</option>
                  <option value="pixels">{en ? 'Shared pixels only' : 'Chỉ số điểm ảnh'}</option>
                  <option value="percent">{en ? 'Overlap percentage only' : 'Chỉ tỷ lệ chồng lấn'}</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <input
                  type="number"
                  min="1"
                  disabled={scanMode === 'percent'}
                  value={minSharedPixels}
                  onChange={(event) => {
                    setMinSharedPixels(Math.max(1, Number(event.target.value)));
                    invalidateResults();
                  }}
                  className="dt-input dt-input-sm dt-mono w-18"
                />
                <span>{en ? 'shared px min' : 'điểm ảnh tối thiểu'}</span>
              </label>

              <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={scanMode === 'pixels'}
                  value={threshold}
                  onChange={(event) => {
                    setThreshold(Math.max(0, Math.min(100, Number(event.target.value))));
                    invalidateResults();
                  }}
                  className="dt-input dt-input-sm dt-mono w-16"
                />
                <span>% {en ? 'of smaller mask' : 'diện tích mask nhỏ'}</span>
              </label>

              <label className="flex cursor-pointer items-center gap-1.5 text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={sameLabelOnly}
                  onChange={(event) => {
                    setSameLabelOnly(event.target.checked);
                    invalidateResults();
                  }}
                  className="h-4 w-4 accent-[var(--accent-primary)]"
                />
                <span>{en ? 'Same label only' : 'Chỉ so sánh cùng nhãn'}</span>
              </label>

              <button
                type="button"
                onClick={runScan}
                disabled={isScanning || !frames.length}
                className="dt-btn dt-btn-primary dt-btn-sm ml-auto"
              >
                {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                {isScanning ? (en ? 'Scanning…' : 'Đang quét…') : en ? 'Scan' : 'Quét lỗi'}
              </button>
            </div>

            {isScanning && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-elevated)]">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}

            {scanError && (
              <p
                role="alert"
                className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-3 py-2 text-xs font-medium text-[var(--status-danger-text)]"
              >
                {scanError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results Split Pane */}
      {dataset && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
          {/* Left: Issues Table */}
          <section className="dt-panel flex flex-col overflow-hidden lg:col-span-5">
            <div className="dt-panel-header bg-[var(--bg-surface-elevated)]">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                {en ? 'Issues' : 'Danh sách lỗi'} ({(results ?? []).length.toLocaleString()})
              </h3>
              {(results?.length ?? 0) > 1000 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  {en ? 'First 1,000 pairs shown.' : 'Hiển thị 1.000 cặp đầu.'}
                </span>
              )}
            </div>

            <div className="dt-table-wrap max-h-[62vh] rounded-none border-0">
              <table className="dt-table">
                <thead>
                  <tr>
                    <th>Frame</th>
                    <th>Mask A</th>
                    <th>Mask B</th>
                    <th className="text-right">{en ? 'Pixels' : 'Pixel giao'}</th>
                    <th className="text-right">{en ? 'Smaller' : 'Mask nhỏ'}</th>
                    <th className="text-right">IoU</th>
                  </tr>
                </thead>
                <tbody>
                  {(results ?? []).slice(0, 1000).map((pair, index) => {
                    const isSelected = pairKey(pair) === pairKey(selectedPair ?? pair);
                    return (
                      <tr
                        key={`${pair.frameId}-${pair.first.id}-${pair.second.id}-${index}`}
                        onClick={() => setSelectedPairKey(pairKey(pair))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedPairKey(pairKey(pair));
                          }
                        }}
                        tabIndex={0}
                        aria-selected={isSelected}
                        className={`cursor-pointer ${isSelected ? 'is-selected' : ''}`}
                      >
                        <td className="dt-mono font-semibold">{pair.frameId}</td>
                        <td className="text-xs">
                          <span className="font-medium">{pair.first.label}</span>{' '}
                          <span className="dt-mono text-[10px] text-[var(--text-muted)]">#{pair.first.id}</span>
                        </td>
                        <td className="text-xs">
                          <span className="font-medium">{pair.second.label}</span>{' '}
                          <span className="dt-mono text-[10px] text-[var(--text-muted)]">#{pair.second.id}</span>
                        </td>
                        <td className="dt-mono text-right">{pair.intersectionPixels.toLocaleString()}</td>
                        <td className="dt-mono text-right font-semibold text-[var(--status-warning-text)]">
                          {pair.overlapOfSmaller.toFixed(2)}%
                        </td>
                        <td className="dt-mono text-right text-[var(--text-secondary)]">
                          {pair.iou.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {results?.length === 0 && (
                <p className="py-10 text-center text-xs text-[var(--text-muted)]">
                  {en
                    ? 'No mask overlaps found for the selected frames and rules.'
                    : 'Không có mask giao nhau theo frame và quy tắc đã chọn.'}
                </p>
              )}
              {results === null && !isScanning && (
                <p className="py-10 text-center text-xs text-[var(--text-muted)]">
                  {en ? 'Click Scan to inspect mask overlaps.' : 'Bấm Quét lỗi để kiểm tra chồng lấn mask.'}
                </p>
              )}
            </div>
          </section>

          {/* Right: Sticky Mask Canvas Preview */}
          <section className="dt-panel overflow-hidden lg:sticky lg:top-0 lg:col-span-7">
            {selectedPair && previewFrame ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <strong className="dt-mono text-[var(--text-primary)]">{`Frame ${selectedPair.frameId}`}</strong>
                    <span className="dt-mono rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-warning-text)]">
                      {selectedPair.intersectionPixels.toLocaleString()} px · {selectedPair.overlapOfSmaller.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                      <i
                        className="inline-block h-2.5 w-2.5 rounded-xs border border-[var(--text-primary)]"
                        style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 2px, currentColor 2px 3px)' }}
                      />
                      {selectedPair.first.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                      <i
                        className="inline-block h-2.5 w-2.5 rounded-xs"
                        style={{ backgroundColor: getLabelColor(selectedPair.second.label, dataset) }}
                      />
                      {selectedPair.second.label}
                    </span>
                    {previewZoom.scale > 1 && (
                      <button
                        type="button"
                        onClick={() => setPreviewZoom({ scale: 1, x: 0, y: 0 })}
                        className="dt-btn dt-btn-secondary dt-btn-sm h-6 px-2"
                      >
                        <RotateCcw className="h-3 w-3" /> {Math.round(previewZoom.scale * 100)}%
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-[var(--bg-viewport)]">
                  <div
                    className="relative mx-auto w-full overflow-hidden"
                    ref={previewViewportRef}
                    onDoubleClick={() => setPreviewZoom({ scale: 1, x: 0, y: 0 })}
                    title={en ? 'Scroll to zoom; double-click to fit' : 'Cuộn chuột để zoom; nhấp đúp để vừa khung'}
                    style={{
                      aspectRatio: `${preview.imageDimensions?.width ?? previewFrame.width}/${preview.imageDimensions?.height ?? previewFrame.height}`,
                      maxHeight: '66vh',
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        transform: `translate(${previewZoom.x}px, ${previewZoom.y}px) scale(${previewZoom.scale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {preview.currentImageSrc ? (
                        <img
                          src={preview.currentImageSrc}
                          alt={`${en ? 'Frame' : 'Khung hình'} ${selectedPair.frameId}`}
                          className="absolute inset-0 h-full w-full object-fill"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">
                          {preview.imageLoading
                            ? en ? 'Loading frame…' : 'Đang tải frame…'
                            : preview.imageError ?? (en ? 'Frame image unavailable' : 'Không tải được ảnh frame')}
                        </div>
                      )}
                      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                    </div>
                  </div>
                </div>

                <p className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3.5 py-2 text-[11px] text-[var(--text-muted)]">
                  {en
                    ? 'Scroll to zoom; double-click to fit. Select another row to change the preview.'
                    : 'Cuộn chuột để zoom; nhấp đúp để vừa khung. Chọn dòng khác để đổi ảnh preview.'}
                </p>
              </>
            ) : (
              <div className="grid min-h-[280px] place-items-center p-6 text-center text-xs text-[var(--text-muted)]">
                {isScanning
                  ? en ? 'Results will appear after the scan.' : 'Preview sẽ hiện sau khi quét xong.'
                  : en ? 'Scan, then select an issue to preview.' : 'Quét rồi chọn lỗi để xem preview.'}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
