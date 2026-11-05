import { useEffect, useState } from 'react';
import { useLocale } from '../i18n/LocaleProvider';

export default function ImageViewCacheSettings() {
  const { locale } = useLocale();
  const vi = locale === 'vi';
  const [info, setInfo] = useState<{ bytes: number; entries: number; limitGB: number } | null>(null);
  const [limit, setLimit] = useState('5');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const cache = window.cvatDesktop?.viewerCache;
  useEffect(() => {
    let active = true;
    void cache?.({ action: 'info' }).then(value => { if (active) { setInfo(value); setLimit(String(value.limitGB)); } }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [cache]);
  if (!cache) return null;
  const run = async (action: 'clear' | 'configure') => {
    setBusy(true); setMessage('');
    try { setInfo(await cache({ action, limitGB: Number(limit) })); setMessage(vi ? 'Đã cập nhật cache.' : 'Cache updated.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3">
    <h3 className="font-semibold">ImageView cache</h3>
    <p className="text-sm text-slate-400">{info ? `${(info.bytes / 1024 ** 3).toFixed(2)} / ${info.limitGB} GB · ${info.entries} ${vi ? 'ảnh' : 'images'}` : '…'}</p>
    <div className="flex flex-wrap items-center gap-3">
      <label>{vi ? 'Giới hạn (GB)' : 'Limit (GB)'} <input aria-label="ImageView cache GB" type="number" min="0.1" max="100" step="0.1" value={limit} onChange={event => setLimit(event.target.value)} className="w-24 rounded border px-2 py-1" /></label>
      <button disabled={busy} onClick={() => void run('configure')} className="rounded border px-3 py-1">{vi ? 'Lưu giới hạn' : 'Save limit'}</button>
      <button disabled={busy} onClick={() => void run('clear')} className="rounded border px-3 py-1">{vi ? 'Xóa cache đĩa' : 'Clear disk cache'}</button>
    </div>
    <p role="status" className="text-sm text-slate-400">{message}</p>
  </div>;
}
