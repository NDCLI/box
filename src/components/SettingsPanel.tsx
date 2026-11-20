import { useEffect, useState } from 'react';
import { Download, Globe, Info, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import ImageViewCacheSettings from './ImageViewCacheSettings';
import StatusPill from './ui/StatusPill';

export default function SettingsPanel() {
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const vi = locale === 'vi';
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<Awaited<ReturnType<NonNullable<NonNullable<Window['cvatDesktop']>['getAppInfo']>>> | null>(null);

  useEffect(() => {
    void window.cvatDesktop?.getAppInfo?.().then(setInfo).catch(() => {});
  }, []);

  const check = async () => {
    setChecking(true);
    setMessage('');
    try {
      const result = await window.cvatDesktop?.checkForUpdates?.();
      setMessage(result?.available ? '' : result?.message || 'Hãy mở bản Portable Windows để kiểm tra cập nhật.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không kiểm tra được cập nhật.');
    } finally {
      setChecking(false);
    }
  };

  const themeOptions: { id: ThemePreference; label: string; icon: typeof Moon }[] = [
    { id: 'dark', label: vi ? 'Tối (Dark)' : 'Dark', icon: Moon },
    { id: 'light', label: vi ? 'Sáng (Light)' : 'Light', icon: Sun },
    { id: 'system', label: vi ? 'Theo hệ thống' : 'System', icon: Monitor },
  ];

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div>
        <span className="dt-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-text)]">
          SYSTEM / PREFERENCES
        </span>
        <h2 className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
          {vi ? 'Cài đặt' : 'Settings'}
        </h2>
      </div>

      {/* Appearance & Language */}
      <div className="dt-panel overflow-hidden">
        <div className="dt-panel-header bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Palette className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>{vi ? 'Giao diện & Ngôn ngữ' : 'Appearance & Language'}</span>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {vi ? 'Chủ đề màu (Theme)' : 'Color theme'}
            </span>
            <div className="inline-grid w-full grid-cols-3 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-1">
              {themeOptions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    theme === id
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="app-language" className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              <Globe className="h-3.5 w-3.5" />
              <span>{vi ? 'Ngôn ngữ' : 'Language'}</span>
            </label>
            <select
              id="app-language"
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'en' | 'vi')}
              className="dt-select w-full"
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </div>
        </div>
      </div>

      {/* ImageView Disk Cache */}
      <ImageViewCacheSettings />

      {/* App Info & Updates */}
      <div className="dt-panel overflow-hidden">
        <div className="dt-panel-header bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Info className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>{vi ? 'Thông tin ứng dụng & Cập nhật' : 'Application Info & Updates'}</span>
          </div>
          <StatusPill tone="accent">
            <span className="dt-mono">v{info?.version || '—'}</span>
          </StatusPill>
        </div>

        <div className="space-y-4 p-4 text-xs">
          <div className="space-y-1.5">
            <p className="font-semibold text-[var(--text-primary)]">
              {vi ? 'Phiên bản đang chạy' : 'Running version'}:{' '}
              <span className="dt-mono text-[var(--accent-text)]">{info?.version || '—'}</span>
            </p>
            {info && (
              <p className="dt-mono break-all text-[11px] text-[var(--text-muted)]">
                {info.executablePath}
              </p>
            )}
            {info?.lastUpdate && (
              <p className="text-xs text-[var(--text-secondary)]">
                {vi ? 'Cập nhật gần nhất' : 'Last update'}:{' '}
                <span className="dt-mono">{info.lastUpdate.fromVersion} → {info.lastUpdate.toVersion}</span> ·{' '}
                {info.lastUpdate.state === 'success'
                  ? (vi ? 'Thành công' : 'Success')
                  : info.lastUpdate.state === 'failed'
                    ? (vi ? 'Thất bại' : 'Failed')
                    : (vi ? 'Chưa hoàn tất' : 'Not completed')}{' '}
                — {info.lastUpdate.message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              disabled={checking}
              onClick={() => void check()}
              className="dt-btn dt-btn-primary"
            >
              <Download className="h-3.5 w-3.5" />
              {checking
                ? (vi ? 'Đang kiểm tra cập nhật…' : 'Checking for updates…')
                : (vi ? 'Kiểm tra cập nhật' : 'Check for updates')}
            </button>
            {message && (
              <p role="status" className="text-xs text-[var(--text-secondary)]">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
