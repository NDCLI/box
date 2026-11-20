import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Play, Search } from 'lucide-react';
import type { Locale } from '../i18n/LocaleProvider';
import type { CVATDataset, CVATFrameData } from '../types';

type Box = { l:string; x1:number; y1:number; x2:number; y2:number };
type Issue = { id:string; name:string; text:string; flags:string[] };
const chars:Record<string,string>={ga:'가',geo:'거',go:'고',gu:'구',na:'나',neo:'너',no:'노',nu:'누',da:'다',deo:'더',do:'도',du:'두',ra:'라',reo:'러',ro:'로',ru:'루',ma:'마',meo:'머',mo:'모',mu:'무',beo:'버',bo:'보',bu:'부',seo:'서',so:'소',su:'수',eo:'어',o:'오',uu:'우',jeo:'저',jo:'조',ju:'주',aa:'아',ba:'바',sa:'사',ja:'자',bae:'배',ha:'하',heo:'허',ho:'호',...Object.fromEntries('0123456789'.split('').map(x=>[x,x]))};
const isHangul=(b:Box)=>b.l in chars&&!/\d/.test(chars[b.l]);
const byX=(boxes:Box[])=>[...boxes].sort((a,b)=>a.x1-b.x1);
function splitRows(boxes:Box[]){if(boxes.length<6)return{rows:[byX(boxes)],two:false};const h=boxes.reduce((s,b)=>s+b.y2-b.y1,0)/boxes.length,xs=boxes.map(b=>(b.x1+b.x2)/2),ys=boxes.map(b=>(b.y1+b.y2)/2),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length,xx=xs.reduce((s,x)=>s+(x-mx)**2,0),slope=xx?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/xx:0,sorted=boxes.map((b,i)=>({y:ys[i]-slope*xs[i],b})).sort((a,b)=>a.y-b.y);let gap=-1,idx=0;for(let i=0;i<sorted.length-1;i++)if(sorted[i+1].y-sorted[i].y>gap){gap=sorted[i+1].y-sorted[i].y;idx=i}return gap>.6*h?{rows:[byX(sorted.slice(0,idx+1).map(x=>x.b)),byX(sorted.slice(idx+1).map(x=>x.b))],two:true}:{rows:[byX(boxes)],two:false}}
const platePattern=/^\d{2,3}[가거고구나너노누다더도두라러로루마머모무버보부서소수어오우저조주아바사자배하허]\d{4}$/;
function inspect(frames:CVATFrameData[]){let boxes=0,two=0,gt=0;const issues:Issue[]=[];for(const frame of frames){const name=frame.name||'',stem=name.split('/').pop()!.replace(/\.[A-Za-z0-9]+$/,'').replace(/-\d+$/,''),hasGt=platePattern.test(stem);if(hasGt)gt++;const bs=frame.boxes.filter(b=>b.annotationKind!=='track'&&!b.outside).map(b=>({l:b.label,x1:b.xtl,y1:b.ytl,x2:b.xbr,y2:b.ybr}));boxes+=bs.length;const flags:string[]=[];if(!bs.length)flags.push('Ảnh chưa có box');const good=(b:Box)=>!!b.l&&[b.x1,b.y1,b.x2,b.y2].every(Number.isFinite)&&b.x1>=0&&b.y1>=0&&b.x2>b.x1&&b.y2>b.y1&&(!frame.width||b.x2<=frame.width)&&(!frame.height||b.y2<=frame.height);if(bs.some(b=>!good(b)))flags.push('Box thiếu nhãn hoặc tọa độ không hợp lệ');const seen=new Set<string>(),dups=new Set<string>();for(const b of bs){const k=JSON.stringify([b.l,b.x1,b.y1,b.x2,b.y2]);if(seen.has(k))dups.add(b.l);seen.add(k)}if(dups.size)flags.push(`Box trùng vị trí: ${[...dups].join(', ')}`);const plates=bs.filter(b=>b.l==='_lp_kor');if(bs.length&&!plates.length)flags.push('Thiếu khung biển số _lp_kor');if(plates.length>1)flags.push('Có nhiều khung biển số _lp_kor');const unknown=bs.filter(b=>!b.l.startsWith('_')&&!(b.l in chars));if(unknown.length)flags.push(`Nhãn chưa ánh xạ: ${[...new Set(unknown.map(b=>b.l))].join(', ')}`);let ch=bs.filter(b=>b.l in chars&&good(b));if(plates.length===1&&good(plates[0])){const p=plates[0],outside=ch.filter(b=>b.x1<p.x1-1||b.y1<p.y1-1||b.x2>p.x2+1||b.y2>p.y2+1);if(outside.length)flags.push('Box ký tự vượt khung biển số');ch=ch.filter(b=>{const x=(b.x1+b.x2)/2,y=(b.y1+b.y2)/2;return x>=p.x1-1&&x<=p.x2+1&&y>=p.y1-1&&y<=p.y2+1})}if(plates.length&&!ch.length)flags.push('Có khung biển số nhưng thiếu box ký tự');const digits=ch.filter(b=>!isHangul(b)),hangulCount=ch.length-digits.length;if(ch.length&&(digits.length<6||digits.length>7))flags.push(`Số box chữ số là ${digits.length}, cần 6 hoặc 7`);outer:for(let i=0;i<ch.length;i++)for(let j=i+1;j<ch.length;j++){const a=ch[i],b=ch[j],iw=Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1),ih=Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1);if(iw>0&&ih>0&&iw*ih/((a.x2-a.x1)*(a.y2-a.y1)+(b.x2-b.x1)*(b.y2-b.y1)-iw*ih)>.5){flags.push('Box ký tự chồng lấn');break outer}}const{rows,two:twoRows}=splitRows(ch);if(twoRows)two++;const flat=rows.flat();if(hangulCount&&(hangulCount!==1||flat.findIndex(isHangul)!==digits.length-4))flags.push('Số lượng/vị trí chữ Hàn bất thường');let text=flat.map(b=>chars[b.l]).join('');if(!hangulCount&&(digits.length===6||digits.length===7)){if(twoRows&&!(rows[0].length===digits.length-4&&rows[1].length===4))flags.push('Cần kiểm tra cách chia biển số hai dòng');if(!twoRows){const ordered=byX(digits),gaps=ordered.slice(1).map((b,i)=>b.x1-ordered[i].x2);let widest=0;gaps.forEach((v,i)=>{if(v>gaps[widest])widest=i});if(widest!==digits.length-5)flags.push('Khoảng cách vị trí chữ Hàn bất thường')}text=text.slice(0,digits.length-4)+'_'+text.slice(digits.length-4)}if(hasGt){const expected=hangulCount?stem:stem.replace(/\D/g,''),actual=hangulCount?text:text.replace('_','');if(actual!==expected)flags.push([...actual].sort().join('')===[...expected].sort().join('')?'Thứ tự ký tự khác tên file':'Chuỗi đọc được khác tên file')}if(flags.length)issues.push({id:frame.id,name,text,flags})}return{images:frames.length,boxes,issues,two,gt}}

export function AnprProject({ locale, dataset }: { locale: Locale; dataset: CVATDataset | null }) {
  const [data, setData] = useState<ReturnType<typeof inspect> | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const en = locale === 'en';

  const bounds = useMemo(() => {
    const ids = (dataset?.frames || []).map((f) => Number(f.id)).filter(Number.isFinite);
    return ids.length
      ? { min: ids.reduce((a, b) => Math.min(a, b)), max: ids.reduce((a, b) => Math.max(a, b)) }
      : { min: 0, max: 0 };
  }, [dataset]);

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    setStart(String(bounds.min));
    setEnd(String(bounds.max));
    setData(null);
    setError('');
  }, [dataset, bounds]);

  const changeRange = (value: string, first: boolean) => {
    if (first) setStart(value);
    else setEnd(value);
    setData(null);
    setError('');
  };

  const run = useCallback(() => {
    if (!dataset) return;
    try {
      const from = start === '' ? bounds.min : Number(start);
      const to = end === '' ? bounds.max : Number(end);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from > to || from < bounds.min || to > bounds.max) {
        throw new Error(en ? 'Enter a valid frame range within the dataset limits.' : 'Hãy nhập vùng frame hợp lệ trong giới hạn dữ liệu.');
      }
      const frames = dataset.frames.filter((f) => Number(f.id) >= from && Number(f.id) <= to);
      if (!frames.length) throw new Error(en ? 'No frames in the selected range.' : 'Không có frame trong vùng đã chọn.');
      setData(inspect(frames));
      setError('');
      setQuery('');
      setFilter('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kiểm tra dataset');
    }
  }, [dataset, start, end, bounds, en]);

  useEffect(() => {
    const timer = window.setTimeout(run, 350);
    return () => window.clearTimeout(timer);
  }, [run]);

  const rows = data?.issues.filter(
    (r) =>
      (!filter || r.flags.includes(filter)) &&
      (!query || r.name.toLowerCase().includes(query.toLowerCase()) || r.id === query),
  ) || [];

  const copy = () => {
    void navigator.clipboard
      .writeText(['Frame\tTên file\tChuỗi đọc\tLý do', ...rows.map((r) => [r.id, r.name, r.text, r.flags.join('; ')].join('\t'))].join('\n'))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      });
  };

  return (
    <section className="flex flex-col gap-3">
      {/* Header & Inline Frame Range Bar */}
      <div className="dt-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <span className="dt-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-text)]">
            PROJECT / ANPR
          </span>
          <h1 className="text-base font-bold text-[var(--text-primary)]">
            {en ? 'License plate labeling check' : 'Kiểm tra gán nhãn biển số'}
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {en ? 'Checks the CVAT dataset currently open in the app.' : 'Kiểm tra dataset CVAT đang mở trong ứng dụng.'}
          </p>
        </div>

        {dataset && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="dt-mono text-xs text-[var(--text-secondary)]">
              Frame {bounds.min}–{bounds.max}
            </span>
            <input
              aria-label={en ? 'Start frame' : 'Frame bắt đầu'}
              type="number"
              step="1"
              min={bounds.min}
              max={bounds.max}
              placeholder={String(bounds.min)}
              value={start}
              onChange={(e) => changeRange(e.target.value, true)}
              className="dt-input dt-input-sm dt-mono w-24"
            />
            <span className="text-xs text-[var(--text-muted)]">→</span>
            <input
              aria-label={en ? 'End frame' : 'Frame kết thúc'}
              type="number"
              step="1"
              min={bounds.min}
              max={bounds.max}
              placeholder={String(bounds.max)}
              value={end}
              onChange={(e) => changeRange(e.target.value, false)}
              className="dt-input dt-input-sm dt-mono w-24"
            />
            <button type="button" onClick={run} className="dt-btn dt-btn-primary dt-btn-sm">
              <Play className="h-3.5 w-3.5" />
              {en ? 'Check' : 'Kiểm tra'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-text)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-danger)]" />
          <span>{error}</span>
        </div>
      )}

      {!dataset && (
        <div className="dt-panel p-6 text-center text-xs text-[var(--text-secondary)]">
          {en ? 'Open a dataset in the Box Counter tab first.' : 'Hãy mở dataset CVAT tại tab Đếm box trước.'}
        </div>
      )}

      {data && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="dt-panel px-3.5 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {en ? 'Images' : 'Tổng số ảnh'}
              </span>
              <span className="dt-mono mt-1 block text-xl font-bold text-[var(--text-primary)]">
                {data.images.toLocaleString()}
              </span>
            </div>
            <div className="dt-panel px-3.5 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {en ? 'Boxes' : 'Tổng box'}
              </span>
              <span className="dt-mono mt-1 block text-xl font-bold text-[var(--text-primary)]">
                {data.boxes.toLocaleString()}
              </span>
            </div>
            <div className="dt-panel px-3.5 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {en ? 'Two-line plates' : 'Biển số 2 dòng'}
              </span>
              <span className="dt-mono mt-1 block text-xl font-bold text-[var(--accent-text)]">
                {data.two.toLocaleString()}
              </span>
            </div>
            <div className="dt-panel border-l-[3px] border-l-[var(--status-warning)] px-3.5 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {en ? 'Needs review' : 'Ảnh cần kiểm tra'}
              </span>
              <span
                className={`dt-mono mt-1 block text-xl font-bold ${
                  data.issues.length ? 'text-[var(--status-warning-text)]' : 'text-[var(--status-success-text)]'
                }`}
              >
                {data.issues.length.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Issues Panel */}
          <article className="dt-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                {data.issues.length ? (
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-[var(--status-warning)]" />
                ) : (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[var(--status-success)]" />
                )}
                <div>
                  <strong className="block text-xs font-semibold text-[var(--text-primary)]">
                    {data.issues.length
                      ? en ? 'Review flagged images' : 'Có ảnh cần kiểm tra lại'
                      : en ? 'No issues found by current rules' : 'Chưa phát hiện vấn đề theo quy tắc hiện có'}
                  </strong>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {en
                      ? 'Warnings need image review; a clean result does not confirm accuracy.'
                      : 'Cảnh báo cần được đối chiếu trên ảnh gốc; kết quả sạch chưa khẳng định nhãn chính xác.'}
                  </p>
                </div>
              </div>

              <button type="button" onClick={copy} className="dt-btn dt-btn-secondary dt-btn-sm">
                {copied ? <Check className="h-3.5 w-3.5 text-[var(--status-success)]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? (en ? 'Copied TSV' : 'Đã sao chép') : (en ? 'Copy TSV' : 'Sao chép TSV')}
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-2.5">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="dt-select dt-select-sm min-w-[220px] flex-1 sm:max-w-xs"
              >
                <option value="">{en ? 'All issues' : 'Tất cả lý do'}</option>
                {[...new Set(data.issues.flatMap((r) => r.flags))].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>

              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={en ? 'Search filename or image ID' : 'Tìm tên file hoặc ID ảnh'}
                  className="dt-input dt-input-sm w-full pl-8"
                />
              </div>
            </div>

            {/* Data Table */}
            <div className="dt-table-wrap max-h-[58vh] rounded-none border-0">
              <table className="dt-table">
                <thead>
                  <tr>
                    <th className="w-24">Frame</th>
                    <th>{en ? 'Filename' : 'Tên file'}</th>
                    <th className="w-40">{en ? 'Reconstructed' : 'Chuỗi đọc'}</th>
                    <th>{en ? 'Review reason' : 'Lý do'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r, i) => (
                    <tr key={`${r.id}-${i}`}>
                      <td className="dt-mono font-semibold">{r.id}</td>
                      <td className="max-w-xs truncate text-xs text-[var(--text-secondary)]" title={r.name}>
                        {r.name || (en ? 'Filename unavailable' : 'Chưa có tên file gốc')}
                      </td>
                      <td className="dt-mono font-semibold text-[var(--text-primary)]">{r.text || '—'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.flags.map((f) => (
                            <span
                              key={f}
                              className="rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-warning-text)]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="py-10 text-center text-xs text-[var(--text-muted)]">
                  {en ? 'No matching flagged images.' : 'Không có ảnh phù hợp.'}
                </p>
              )}
            </div>

            <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-4 py-2 text-[11px] text-[var(--text-secondary)]">
              <span className="dt-mono font-semibold text-[var(--text-primary)]">{rows.length.toLocaleString()}</span>{' '}
              {en
                ? 'flagged images; TSV copies all filtered rows.'
                : `ảnh cần xem lại${rows.length > 500 ? ' (bảng hiển thị 500 ảnh đầu)' : ''}; TSV sao chép toàn bộ kết quả đã lọc.`}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
