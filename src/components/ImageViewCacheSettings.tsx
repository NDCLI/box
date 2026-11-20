import { useEffect, useState } from 'react';
import { HardDrive, Save, Trash2 } from 'lucide-react';
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
    void cache?.({ action: 'info' })
      .then((value) => {
        if (active) {
          setInfo(value);
          setLimit(String(value.limitGB));
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => { active = false; };
  }, [cache]);

  if (!cache) return null;

  const run = async (action: 'clear' | 'configure') => {
    setBusy(true);
    setMessage('');
    try {
      setInfo(await cache({ action, limitGB: Number(limit) }));
      setMessage(vi ? 'Đã cập nhật cache.' : 'Cache updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const usedGB = info ? info.bytes / 1024 ** 3 : 0;
  const usagePct = info && info.limitGB > 0 ? Math.min(100, Math.round((usedGB / info.limitGB) * 100)) : 0;

  return (
    <div className="dt-panel overflow-hidden">
      <div className="dt-panel-header bg-[var(--bg-surface-elevated)]">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
          <HardDrive className="h-4 w-4 text-[var(--status-info)]" />
          <h3>ImageView cache</h3>
        </div>
        <span className="dt-mono text-xs text-[var(--text-secondary)]">
          {info ? `${usedGB.toFixed(2)} / ${info.limitGB} GB · ${info.entries} ${vi ? 'ảnh' : 'images'}` : '…'}
        </span>
      </div>

      <div className="space-y-3 p-4 text-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-200"
            style={{ width: `${usagePct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
            <span>{vi ? 'Giới hạn (GB)' : 'Limit (GB)'}</span>
            <input
              aria-label="ImageView cache GB"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="dt-input dt-input-sm dt-mono w-24"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run('configure')}
            className="dt-btn dt-btn-secondary dt-btn-sm"
          >
            <Save className="h-3.5 w-3.5" />
            {vi ? 'Lưu giới hạn' : 'Save limit'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run('clear')}
            className="dt-btn dt-btn-danger dt-btn-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {vi ? 'Xóa cache đĩa' : 'Clear disk cache'}
          </button>
        </div>

        {message && (
          <p role="status" className="text-xs text-[var(--text-secondary)]">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
