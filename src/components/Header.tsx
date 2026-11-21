import { Moon, Sun, Languages, Server, HardDrive } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';
import StatusPill from './ui/StatusPill';
import type { CVATDataset } from '../types';
import type { CvatFrameSource } from '../hooks/useFrameImage';

const appIconUrl = `${import.meta.env.BASE_URL}app-icon.svg`;

interface HeaderProps {
  dataset?: CVATDataset | null;
  cvatFrameSource?: CvatFrameSource | null;
  activeProject?: 'count' | 'anpr' | 'dpm' | 'imageview' | 'settings';
}

function formatServerHost(serverUrl: string): string {
  try {
    const parsed = new URL(serverUrl);
    return parsed.host || serverUrl;
  } catch {
    return serverUrl;
  }
}

function Header({ dataset, cvatFrameSource, activeProject }: HeaderProps) {
  const { locale, setLocale } = useLocale();
  const { resolvedTheme, toggleTheme } = useTheme();
  const vi = locale === 'vi';

  const sectionLabel = (() => {
    if (activeProject === 'settings') return vi ? 'Cài đặt' : 'Settings';
    if (!dataset) return vi ? 'Nguồn dữ liệu' : 'Data Source';
    if (activeProject === 'anpr') return vi ? 'ANPR biển số' : 'ANPR Plates';
    if (activeProject === 'dpm') return 'DPM / SSEG';
    if (activeProject === 'imageview') return 'ImageView';
    return vi ? 'Box & Trùng lặp' : 'Box & Duplicates';
  })();

  const serverHost = cvatFrameSource?.connection.mode === 'electron' || cvatFrameSource?.connection.mode === 'direct'
    ? formatServerHost(cvatFrameSource.connection.serverUrl)
    : null;

  return (
    <header className="app-header shrink-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src={appIconUrl} alt="" className="app-logo h-7 w-7 shrink-0" />
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
            Cvat Tools
          </h1>
          <span className="text-[var(--border-strong)] select-none" aria-hidden="true">/</span>
          <span className="truncate text-xs font-medium text-[var(--text-secondary)]">
            {sectionLabel}
          </span>
          {dataset && (
            <>
              <span className="hidden md:inline text-[var(--border-strong)] select-none" aria-hidden="true">·</span>
              <span
                className="hidden md:inline truncate max-w-[260px] lg:max-w-[380px] text-xs font-mono text-[var(--text-muted)]"
                title={dataset.taskName || dataset.filename}
              >
                {dataset.taskName || dataset.filename}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {cvatFrameSource ? (
          <StatusPill
            tone="success"
            dot
            title={
              vi
                ? `Đang kết nối CVAT Server${serverHost ? ` (${serverHost})` : ''} · ${cvatFrameSource.jobId ? `Job #${cvatFrameSource.jobId}` : `Task #${cvatFrameSource.taskId}`}`
                : `Connected to CVAT Server${serverHost ? ` (${serverHost})` : ''} · ${cvatFrameSource.jobId ? `Job #${cvatFrameSource.jobId}` : `Task #${cvatFrameSource.taskId}`}`
            }
          >
            <Server className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="dt-mono">{serverHost || 'CVAT'}</span>
            <span className="opacity-70">·</span>
            <span className="dt-mono">
              {cvatFrameSource.jobId ? `Job #${cvatFrameSource.jobId}` : `Task #${cvatFrameSource.taskId}`}
            </span>
          </StatusPill>
        ) : dataset ? (
          <StatusPill
            tone="info"
            dot
            title={vi ? 'Đang mở tệp cục bộ (không kết nối máy chủ)' : 'Local offline file (no server connection)'}
          >
            <HardDrive className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{dataset.source === 'zip' ? 'Offline ZIP' : 'Offline XML'}</span>
          </StatusPill>
        ) : (
          <StatusPill tone="neutral" dot>
            <span>{vi ? 'Chưa mở nguồn' : 'No source loaded'}</span>
          </StatusPill>
        )}

        <button
          type="button"
          onClick={() => setLocale(vi ? 'en' : 'vi')}
          className="dt-btn dt-btn-ghost dt-btn-sm px-2 font-mono text-[11px]"
          title={vi ? 'Chuyển sang tiếng Anh (English)' : 'Switch to Vietnamese (Tiếng Việt)'}
          aria-label={vi ? 'Đổi ngôn ngữ' : 'Switch language'}
        >
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{vi ? 'VI' : 'EN'}</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="dt-icon-btn"
          title={
            resolvedTheme === 'dark'
              ? (vi ? 'Chuyển sang giao diện Sáng' : 'Switch to Light theme')
              : (vi ? 'Chuyển sang giao diện Tối' : 'Switch to Dark theme')
          }
          aria-label={
            resolvedTheme === 'dark'
              ? (vi ? 'Chuyển sang giao diện Sáng' : 'Switch to Light theme')
              : (vi ? 'Chuyển sang giao diện Tối' : 'Switch to Dark theme')
          }
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

export default Header;
