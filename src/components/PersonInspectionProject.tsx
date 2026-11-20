import { useMemo, useState } from 'react';
import type { CVATDataset } from '../types';
import { defaultPersonThresholds, inspectPersons, personFindingUrl, personFindingsCsv, type PersonThresholds } from '../utils/personInspection';

export default function PersonInspectionProject({ dataset, locale }: { dataset: CVATDataset; locale: string }) {
  const vi = locale === 'vi';
  const t = (vn: string, en: string) => vi ? vn : en;
  const [thresholds, setThresholds] = useState(defaultPersonThresholds);
  const [frame, setFrame] = useState('');
  const [label, setLabel] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(0);
  const valid = Object.values(thresholds).every(v => Number.isFinite(v) && v > 0) && thresholds.width <= 100 && thresholds.height <= 100 && thresholds.area <= 100 && thresholds.relative > 1;
  const report = useMemo(() => valid ? inspectPersons(dataset, thresholds) : null, [dataset, thresholds, valid]);
  const filtered = useMemo(() => report?.findings.filter(p => (!frame || p.frameId === frame.trim()) && (!label || p.box.label === label) && (!severity || p.severity === severity)) ?? [], [report, frame, label, severity]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 100) - 1));
  const input = 'rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-sm text-[var(--text-primary)]';
  const fields: [keyof PersonThresholds, string][] = [['width', 'Width (% ảnh / image)'], ['height', 'Height (% ảnh / image)'], ['area', 'Area (% ảnh / image)'], ['aspect', 'Aspect Ratio (W/H)'], ['relative', 'Relative Size (× median)']];
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([personFindingsCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'OD-CPPE-person-inspection.csv';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="space-y-5 p-4" aria-label="OD/CPPE">
    <div><h2 className="text-xl font-semibold">OD/CPPE – Person Label Inspection</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('Cảnh báo hỗ trợ kiểm tra, không kết luận sai label và không tự sửa annotation. Người gần camera, đang ngồi hoặc góc nhìn đặc biệt có thể có bbox lớn hợp lệ.', 'Review assistance only: warnings do not prove incorrect labels or change annotations. Close-up, seated people and unusual viewpoints may have valid large boxes.')}</p></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-live="polite">
      {[[report?.total, t('Tổng Person kiểm tra', 'Persons inspected')], [report?.findings.length, t('Bounding box bất thường', 'Flagged boxes')], [report?.findings.filter(p => p.severity === 'High').length, t('Nghi ngờ nhầm label (High)', 'Suspected label issues (High)')], [report ? `${(report.total ? report.findings.length / report.total * 100 : 0).toFixed(2)}%` : undefined, t('Tỷ lệ bất thường', 'Flag rate')]].map(([value, caption]) => <div key={caption} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"><div className="text-2xl font-semibold">{value ?? '—'}</div><div className="mt-1 text-xs text-[var(--text-secondary)]">{caption}</div></div>)}
    </div>
    <fieldset className="rounded-xl border border-[var(--border-default)] p-4"><legend className="px-2 font-semibold">{t('Điều kiện kiểm tra', 'Inspection thresholds')}</legend>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{fields.map(([key, caption]) => <label key={key} className="flex flex-col gap-2 text-xs">{caption}<input className={input} type="number" min={key === 'relative' ? 1.01 : 0.01} max={['width', 'height', 'area'].includes(key) ? 100 : undefined} step="any" value={Number.isNaN(thresholds[key]) ? '' : thresholds[key]} onChange={e => { setThresholds({ ...thresholds, [key]: e.target.valueAsNumber }); setPage(0); }} /></label>)}</div>
      <p className="mt-3 text-xs text-[var(--text-secondary)]">{t('Quét tự động toàn bộ bbox person trong nguồn đang mở khi thay đổi ngưỡng. High: Area hoặc Relative Size lớn kết hợp Aspect Ratio. Medium: diện tích lớn. Low: chỉ Width, Height hoặc Aspect Ratio. So sánh dùng trung vị diện tích chuẩn hóa theo ảnh, cần ít nhất 5 Person có kích thước ảnh.', 'All person boxes in the current source are scanned automatically when thresholds change. High: large Area or Relative Size plus Aspect Ratio. Medium: large area. Low: Width, Height or Aspect Ratio alone. Comparison uses median image-normalized area and requires at least 5 persons with image dimensions.')}</p>
      <button className={`${input} mt-3`} onClick={() => setThresholds(defaultPersonThresholds)}>{t('Khôi phục ngưỡng mặc định', 'Reset thresholds')}</button>
      {!valid && <p role="alert" className="mt-2 text-red-500">{t('Ngưỡng phải lớn hơn 0; phần trăm ≤ 100; Relative Size > 1.', 'Thresholds must be positive; percentages ≤ 100; Relative Size > 1.')}</p>}
    </fieldset>
    {(dataset.type === 'tracks' || dataset.viewerPayload?.annotations.tracks?.length) && <p role="note" className="text-sm text-amber-600">{t('Track: chỉ kiểm tra các mốc bbox đã lưu; chưa nội suy các frame giữa mốc. Số Person là số bbox, không phải số người duy nhất.', 'Tracks: only saved box samples are inspected; intermediate frames are not interpolated. Person counts represent boxes, not unique people.')}</p>}
    {report && <p className="text-xs text-[var(--text-secondary)]">{t(`Bỏ qua ${report.skipped} Person không phải rectangle hoặc tọa độ không hợp lệ. ${report.missingDimensions} bbox thiếu kích thước ảnh.`, `Skipped ${report.skipped} non-rectangle or invalid person boxes. ${report.missingDimensions} boxes lack image dimensions.`)} {report.median === null && t('Chưa đủ mẫu để so sánh Relative Size.', 'Insufficient samples for Relative Size.')}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs">Frame ID<input className={input} placeholder={t('Tất cả frame', 'All frames')} value={frame} onChange={e => { setFrame(e.target.value); setPage(0); }} /></label>
      <label className="flex flex-col gap-1 text-xs">Label<select className={input} value={label} onChange={e => { setLabel(e.target.value); setPage(0); }}><option value="">{t('Tất cả Person', 'All persons')}</option>{dataset.labels.filter(l => l.trim().toLowerCase() === 'person').map(l => <option key={l}>{l}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs">{t('Mức độ', 'Severity')}<select className={input} value={severity} onChange={e => { setSeverity(e.target.value); setPage(0); }}><option value="">{t('Tất cả mức độ', 'All severities')}</option>{['High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}</select></label>
      <button className={input} disabled={!filtered.length} onClick={exportCsv}>{t('Xuất CSV (mở bằng Excel)', 'Export CSV (Excel compatible)')} · {filtered.length}</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]"><table className="w-full text-left text-xs"><thead className="bg-[var(--bg-surface)]"><tr>{['Frame ID', 'Annotation ID', 'Label', 'BBox (x, y, w, h)', 'Area %', 'Relative', 'W/H', t('Lý do', 'Reasons'), t('Mức độ', 'Severity'), 'CVAT'].map(h => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>
      {filtered.slice(currentPage * 100, (currentPage + 1) * 100).map(p => { const url = personFindingUrl(dataset, p); return <tr key={`${p.frameId}:${p.box.globalIndex}:${p.box.id}`} className="border-t border-[var(--border-default)]"><td className="p-3">{p.frameId}</td><td className="p-3">{p.box.trackId ? `Track ${p.box.trackId}` : p.box.serverShapeId ?? p.box.id}</td><td className="p-3">{p.box.label}</td><td className="whitespace-nowrap p-3 font-mono">{[p.box.xtl, p.box.ytl, p.width, p.height].map(n => n.toFixed(1)).join(', ')}</td><td className="p-3">{p.areaPercent?.toFixed(2) ?? '—'}</td><td className="p-3">{p.relative === null ? '—' : `${p.relative.toFixed(2)}×`}</td><td className="p-3">{p.aspect.toFixed(2)}</td><td className="p-3">{p.reasons.join(' + ')}</td><td className={`p-3 font-semibold ${p.severity === 'High' ? 'text-red-500' : p.severity === 'Medium' ? 'text-amber-600' : 'text-[var(--text-secondary)]'}`}>{p.severity}</td><td className="p-3">{url ? <a className="underline" href={url} target="_blank" rel="noreferrer">{t('Mở annotation', 'Open annotation')}</a> : <span title={t('Cần mở Job CVAT có ID annotation server.', 'Requires a CVAT Job with server annotation IDs.')}>—</span>}</td></tr>; })}
      {!filtered.length && <tr><td colSpan={10} className="p-8 text-center text-[var(--text-secondary)]">{!report ? t('Hãy nhập ngưỡng hợp lệ.', 'Enter valid thresholds.') : report.total === 0 ? t('Không có bbox Person hợp lệ trong nguồn đang mở.', 'No valid person boxes in the current source.') : t('Không có cảnh báo phù hợp với ngưỡng và bộ lọc hiện tại. Điều này không xác nhận mọi label đều đúng.', 'No warnings match the current thresholds and filters. This does not certify label correctness.')}</td></tr>}
    </tbody></table></div>
    <div className="flex items-center justify-end gap-3 text-sm"><button className={input} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('Trước', 'Previous')}</button><span>{currentPage + 1} / {Math.max(1, Math.ceil(filtered.length / 100))}</span><button className={input} disabled={(currentPage + 1) * 100 >= filtered.length} onClick={() => setPage(currentPage + 1)}>{t('Sau', 'Next')}</button></div>
  </section>;
}
