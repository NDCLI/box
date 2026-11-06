import { useEffect, useMemo, useRef, useState } from 'react';
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
    const ids = (dataset?.frames ?? []).map(frame => Number(frame.id)).filter(Number.isFinite);
    return ids.length ? { min: Math.min(...ids), max: Math.max(...ids) } : { min: 0, max: 0 };
  }, [dataset]);
  const [start, setStart] = useState<number | ''>('');
  const [end, setEnd] = useState<number | ''>('');
  const [threshold, setThreshold] = useState(10);
  const [sameLabelOnly, setSameLabelOnly] = useState(false);
  const [minSharedPixels, setMinSharedPixels] = useState(10);
  const [scanRequest, setScanRequest] = useState<{ frames: MaskFrame[]; threshold: number; minIntersectionPixels: number; sameLabelOnly: boolean } | null>(null);
  const [results, setResults] = useState<MaskOverlapPair[] | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPairKey, setSelectedPairKey] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const from = start === '' ? bounds.min : start;
  const to = end === '' ? bounds.max : end;
  const frames = useMemo(() => (dataset?.frames ?? []).filter(frame => Number(frame.id) >= from && Number(frame.id) <= to), [dataset, from, to]);
  const maskCount = useMemo(() => frames.reduce((sum, frame) => sum + frame.boxes.filter(box => box.shapeType === 'mask' && !box.outside).length, 0), [frames]);
  const pairKey = (pair: MaskOverlapPair) => `${pair.frameId}:${pair.first.id}:${pair.second.id}`;
  const selectedPair = results?.find(pair => pairKey(pair) === selectedPairKey) ?? results?.[0] ?? null;
  const previewFrame: CVATFrameData | null = selectedPair ? dataset?.frames.find(frame => frame.id === selectedPair.frameId) ?? null : null;
  const previewMaskA: CVATBox | undefined = previewFrame?.boxes.find(box => box.id === selectedPair?.first.id);
  const previewMaskB: CVATBox | undefined = previewFrame?.boxes.find(box => box.id === selectedPair?.second.id);
  const preview = useFrameImage({ selectedFrameData: previewFrame, zipEntries, manualImages, cvatFrameSource });

  useEffect(() => {
    if (!selectedPair || !previewFrame) return;
    setSelectedPairKey(pairKey(selectedPair));
  }, [selectedPair?.frameId, selectedPair?.first.id, selectedPair?.second.id]);

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

  const invalidateResults = () => { setScanRequest(null); setResults(null); setSelectedPairKey(''); setScanError(''); setIsScanning(false); setProgress({ completed: 0, total: 0 }); };
  const runScan = () => {
    if (!frames.length) return;
    const maskFrames: MaskFrame[] = frames.map(frame => ({
      id: frame.id, name: frame.name, width: frame.width, height: frame.height,
      boxes: frame.boxes.filter(box => box.shapeType === 'mask' && !box.outside).map(box => ({
        id: box.id, label: box.label, xtl: box.xtl, ytl: box.ytl, xbr: box.xbr, ybr: box.ybr, maskRle: box.maskRle,
      })),
    }));
    setResults(null);
    setSelectedPairKey('');
    setScanError('');
    setProgress({ completed: 0, total: maskFrames.length });
    setScanRequest({ frames: maskFrames, threshold, minIntersectionPixels: minSharedPixels, sameLabelOnly });
  };

  return <section className="anpr-project dpm-sseg-project">
    <header><div><h1>{en ? 'Mask overlap check' : 'Kiểm tra chồng lấn mask'}</h1></div></header>
    {!dataset ? <div className="anpr-card">{en ? 'Open a dataset in the Home tab first.' : 'Hãy mở dataset ở Trang chính trước.'}</div> : <>
      <div className="anpr-card dpm-sseg-controls mb-3">
        <div className="dpm-sseg-toolbar">
          <span className="text-xs text-slate-400">{en ? 'Frame' : 'Frame'} {bounds.min}–{bounds.max}</span>
          <input aria-label={en ? 'Start frame' : 'Frame bắt đầu'} type="number" min={bounds.min} max={bounds.max} value={start} placeholder={String(bounds.min)} onChange={event => { setStart(event.target.value === '' ? '' : Number(event.target.value)); invalidateResults(); }}/>
          <span className="self-center">→</span>
          <input aria-label={en ? 'End frame' : 'Frame kết thúc'} type="number" min={bounds.min} max={bounds.max} value={end} placeholder={String(bounds.max)} onChange={event => { setEnd(event.target.value === '' ? '' : Number(event.target.value)); invalidateResults(); }}/>
          <label className="flex items-center gap-1"><input type="number" min="1" value={minSharedPixels} onChange={event => { setMinSharedPixels(Math.max(1, Number(event.target.value))); invalidateResults(); }} className="w-16"/>{en ? 'shared px min' : 'pixel giao min'}</label>
          <label className="flex items-center gap-1"><input type="number" min="0" max="100" value={threshold} onChange={event => { setThreshold(Math.max(0, Math.min(100, Number(event.target.value)))); invalidateResults(); }} className="w-16"/>% {en ? 'of smaller mask' : 'mask nhỏ'}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={sameLabelOnly} onChange={event => { setSameLabelOnly(event.target.checked); invalidateResults(); }}/>{en ? 'Same label only' : 'Chỉ cùng nhãn'}</label>
          <button onClick={runScan} disabled={isScanning || !frames.length}>{isScanning ? (en ? 'Scanning…' : 'Đang quét…') : (en ? 'Scan' : 'Quét')}</button>
        </div>
      </div>
      <article className="anpr-card dpm-sseg-results">
        {scanError && <p className="anpr-error">{scanError}</p>}
        <div className="dpm-sseg-status" role="status">{isScanning ? (en ? `Scanning ${progress.completed}/${progress.total} frames…` : `Đang quét ${progress.completed}/${progress.total} frame…`) : results === null ? (en ? `${frames.length.toLocaleString()} frames · ${maskCount.toLocaleString()} masks` : `${frames.length.toLocaleString()} frame · ${maskCount.toLocaleString()} mask`) : (en ? `${results.length.toLocaleString()} overlapping pairs` : `${results.length.toLocaleString()} cặp mask bị chồng lấn`)}</div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
          <section className="lg:col-span-7">
            <h3 className="mb-1 text-xs font-bold">{en ? 'Issues' : 'Danh sách lỗi'} ({(results ?? []).length.toLocaleString()})</h3>
            <div className="anpr-table-wrap rounded-lg border border-slate-700"><table><thead><tr><th>Frame</th><th>Mask A</th><th>Mask B</th><th>{en ? 'Pixels' : 'Pixel giao'}</th><th>{en ? 'Smaller mask' : 'Mask nhỏ'}</th><th>IoU</th></tr></thead>
              <tbody>{(results ?? []).slice(0, 1000).map((pair, index) => {
                const isSelected = pairKey(pair) === pairKey(selectedPair ?? pair);
                return <tr key={`${pair.frameId}-${pair.first.id}-${pair.second.id}-${index}`} onClick={() => setSelectedPairKey(pairKey(pair))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedPairKey(pairKey(pair)); } }} tabIndex={0} aria-selected={isSelected} className={`cursor-pointer hover:bg-slate-800/70 ${isSelected ? 'bg-sky-900/40 outline outline-1 outline-sky-500' : ''}`}><td>{pair.frameId}<br/><small>{pair.frameName}</small></td><td>{pair.first.label} <small>#{pair.first.id}</small></td><td>{pair.second.label} <small>#{pair.second.id}</small></td><td>{pair.intersectionPixels.toLocaleString()}</td><td>{pair.overlapOfSmaller.toFixed(2)}%</td><td>{pair.iou.toFixed(2)}%</td></tr>;
              })}</tbody></table>
              {results?.length === 0 && <p className="anpr-empty">{en ? 'No mask overlaps found for the selected frames and rules.' : 'Không có mask giao nhau theo frame và quy tắc đã chọn.'}</p>}</div>
            {(results?.length ?? 0) > 1000 && <p className="anpr-foot">{en ? 'First 1,000 pairs shown.' : 'Hiển thị 1.000 cặp đầu.'}</p>}
          </section>
          <section className="lg:col-span-5 lg:sticky lg:top-4">
            {selectedPair && previewFrame ? <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-3 py-2 text-xs text-slate-200">
                <b>{`Frame ${selectedPair.frameId}`}</b>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-white" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 2px, #fff 2px 3px)' }}/>{selectedPair.first.label}<i className="ml-2 mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: getLabelColor(selectedPair.second.label, dataset) }}/>{selectedPair.second.label}</span>
              </div>
              <div className="relative mx-auto w-full" style={{ aspectRatio: `${preview.imageDimensions?.width ?? previewFrame.width}/${preview.imageDimensions?.height ?? previewFrame.height}`, maxHeight: '70vh' }}>
                {preview.currentImageSrc ? <img src={preview.currentImageSrc} alt={`${en ? 'Frame' : 'Khung hình'} ${selectedPair.frameId}`} className="absolute inset-0 h-full w-full object-fill"/> : <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">{preview.imageLoading ? (en ? 'Loading frame…' : 'Đang tải frame…') : preview.imageError ?? (en ? 'Frame image unavailable' : 'Không tải được ảnh frame')}</div>}
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none"/>
              </div>
              <p className="border-t border-slate-700 px-3 py-2 text-[11px] text-slate-400">{en ? 'Select another row to update this preview.' : 'Bấm vào lỗi khác để cập nhật ảnh preview tại đây.'}</p>
            </div> : <div className="grid min-h-20 place-items-center rounded-xl border border-slate-700 bg-slate-950 p-3 text-center text-xs text-slate-400">{isScanning ? (en ? 'Results will appear after the scan.' : 'Preview sẽ hiện sau khi quét xong.') : (en ? 'Scan, then select an issue to preview.' : 'Quét rồi chọn lỗi để xem preview.')}</div>}
          </section>
        </div>
      </article>
    </>}
  </section>;
}
