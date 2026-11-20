import { CloudDownload, KeyRound, ListChecks, LoaderCircle, Lock, Server, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CVATDataset } from '../types';
import {
  getCvatJobTaskId,
  listCvatJobs,
  listCvatTasks,
  loadCvatJobDataset,
  loadCvatTaskDataset,
  type CvatConnection,
  type CvatJobSummary,
  type CvatTaskSummary,
} from '../utils/cvatApi';
import StatusPill from './ui/StatusPill';

const DEFAULT_SERVERS = [
  'http://10.43.2.147:8080',
  'http://10.43.2.12:8080',
];

interface CvatConnectPanelProps {
  onDatasetLoaded: (dataset: CVATDataset, connection: CvatConnection, taskId: number, jobId?: number) => void;
}

export default function CvatConnectPanel({ onDatasetLoaded }: CvatConnectPanelProps) {
  const desktopAvailable = Boolean(window.cvatDesktop);
  const [serverUrl, setServerUrl] = useState(() => {
    try { return localStorage.getItem('cvat-connection-server') || DEFAULT_SERVERS[0]; } catch { return DEFAULT_SERVERS[0]; }
  });
  const [token, setToken] = useState('');
  const [tasks, setTasks] = useState<CvatTaskSummary[]>([]);
  const [taskId, setTaskId] = useState('');
  const [jobs, setJobs] = useState<CvatJobSummary[]>([]);
  const [jobId, setJobId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenRestoring, setIsTokenRestoring] = useState(false);
  const [hasDefaultToken, setHasDefaultToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setToken('');
    setTasks([]); setJobs([]); setTaskId(''); setJobId('');
    try { const url = new URL(serverUrl); if (!['http:', 'https:'].includes(url.protocol)) return; }
    catch { setIsTokenRestoring(false); return; }
    try { localStorage.setItem('cvat-connection-server', serverUrl); } catch { /* Optional preference. */ }
    try {
      const saved = JSON.parse(localStorage.getItem(`cvat-last-selection:${serverUrl}`) || 'null');
      if (Number.isSafeInteger(saved?.taskId) && saved.taskId > 0) setTaskId(String(saved.taskId));
      if (Number.isSafeInteger(saved?.jobId) && saved.jobId > 0) setJobId(String(saved.jobId));
    } catch { /* Optional preference. */ }
    if (desktopAvailable) setIsTokenRestoring(true);
    void window.cvatDesktop?.hasDefaultToken().then((hasToken) => { if (active) setHasDefaultToken(hasToken); });
    void window.cvatDesktop?.getStoredToken(serverUrl)
      .then((storedToken) => { if (active && storedToken) setToken(storedToken); })
      .catch(() => { if (active) setError('Không khôi phục được PAT cho server này.'); })
      .finally(() => { if (active) setIsTokenRestoring(false); });
    return () => { active = false; };
  }, [desktopAvailable, serverUrl]);

  const saveCurrentToken = () => {
    void window.cvatDesktop?.saveToken(token, serverUrl).catch((err) => {
      setError(err instanceof Error ? err.message : 'Không thể lưu PAT đã mã hóa.');
    });
  };

  const connection = (): CvatConnection => ({ mode: 'electron', serverUrl, token });

  const loadJobsForTask = async (id: number) => {
    const loadedJobs = await listCvatJobs(connection(), id);
    setJobs(loadedJobs);
    setJobId(loadedJobs[0] ? String(loadedJobs[0].id) : '');
    if (loadedJobs.length === 0) setError('Task này không có Job nào mà token có quyền đọc.');
  };

  const handleListTasks = async () => {
    if (!serverUrl.trim() || (!token.trim() && !hasDefaultToken)) {
      setError('Nhập URL CVAT và Personal Access Token trước.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await window.cvatDesktop?.saveToken(token, serverUrl);
      const loadedTasks = await listCvatTasks(connection());
      setTasks(loadedTasks);
      setJobs([]);
      setJobId('');
      if (loadedTasks.length === 0) {
        setTaskId('');
        setError('Không tìm thấy Task nào mà token có quyền đọc.');
      } else {
        setTaskId(String(loadedTasks[0].id));
        await loadJobsForTask(loadedTasks[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối tới CVAT. Kiểm tra cấu hình Vercel hoặc CORS.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskChange = async (value: string) => {
    setTaskId(value);
    setJobs([]);
    setJobId('');
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) return;

    setError(null);
    setIsLoading(true);
    try {
      await loadJobsForTask(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách Job từ CVAT.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (wholeTask: boolean) => {
    let activeTaskId = Number(taskId);
    const activeJobId = Number(jobId.match(/\/jobs\/(\d+)(?:[/?#]|$)/)?.[1] ?? jobId);
    if ((wholeTask && (!Number.isInteger(activeTaskId) || activeTaskId < 1)) || (!wholeTask && (!Number.isInteger(activeJobId) || activeJobId < 1))) {
      setError(wholeTask ? 'Chọn Task hợp lệ.' : 'Chọn Task và Job hợp lệ.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const activeConnection = connection();
      if (!wholeTask && (!Number.isInteger(activeTaskId) || activeTaskId < 1)) {
        activeTaskId = await getCvatJobTaskId(activeConnection, activeJobId);
        setTaskId(String(activeTaskId));
      }
      const dataset = wholeTask
        ? await loadCvatTaskDataset(activeConnection, activeTaskId)
        : await loadCvatJobDataset(activeConnection, activeTaskId, activeJobId);
      await window.cvatDesktop?.saveToken(token, serverUrl);
      try { localStorage.setItem(`cvat-last-selection:${serverUrl}`, JSON.stringify({ taskId: activeTaskId, jobId: wholeTask ? undefined : activeJobId })); } catch { /* Optional preference. */ }
      onDatasetLoaded?.(dataset, activeConnection, activeTaskId, wholeTask ? undefined : activeJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải annotation từ CVAT.');
    } finally {
      setIsLoading(false);
    }
  };

  const patTone = !desktopAvailable
    ? 'warning'
    : isTokenRestoring
      ? 'info'
      : token
        ? 'success'
        : hasDefaultToken
          ? 'warning'
          : 'neutral';

  return (
    <section className="dt-panel overflow-hidden text-left">
      {/* Panel Header */}
      <div className="dt-panel-header bg-[var(--bg-surface-elevated)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
            <Server className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Đọc trực tiếp từ CVAT</h2>
            <p className="text-xs text-[var(--text-secondary)]">Mở một Job hoặc cả Task để kiểm tra annotation từ CVAT.</p>
          </div>
        </div>

        <StatusPill tone={patTone} dot pulse={isTokenRestoring}>
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {!desktopAvailable
              ? 'Desktop only'
              : isTokenRestoring
                ? 'Đang khôi phục PAT đã lưu…'
                : token
                  ? 'PAT DPAPI'
                  : hasDefaultToken
                    ? 'Default PAT'
                    : 'No PAT'}
          </span>
        </StatusPill>
      </div>

      {/* Step 1: Server & PAT */}
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Server CVAT mặc định
              <select
                value={DEFAULT_SERVERS.includes(serverUrl) ? serverUrl : ''}
                onChange={(event) => setServerUrl(event.target.value)}
                className="dt-select mt-1.5 w-full dt-mono text-xs"
              >
                {DEFAULT_SERVERS.map((server) => <option key={server} value={server}>{server}</option>)}
                {!DEFAULT_SERVERS.includes(serverUrl) && <option value="">URL tùy chỉnh</option>}
              </select>
            </label>
            <label className="block text-[11px] text-[var(--text-muted)]">
              Hoặc nhập URL tùy chỉnh:
              <input
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="https://cvat.example.com"
                className="dt-input mt-1 w-full dt-mono text-xs"
                autoComplete="url"
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Personal Access Token (đọc và xóa Shape trong Job)
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                onBlur={saveCurrentToken}
                placeholder="Dán token CVAT"
                type="password"
                className="dt-input mt-1.5 w-full dt-mono text-xs"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
              <span>PAT được mã hóa theo tài khoản Windows trên thiết bị này; không lưu trong mã nguồn hoặc Vercel.</span>
              {token && (
                <span className="dt-mono font-medium text-[var(--status-success-text)]">
                  Đã nhập: {token.length} ký tự
                </span>
              )}
            </div>
            {!token && hasDefaultToken && (
              <p className="text-[11px] font-medium text-[var(--status-warning-text)]">
                Đang dùng PAT mặc định của bản app. Nhập PAT vào ô trên để ghi đè.
              </p>
            )}
          </div>
        </div>

        {!desktopAvailable && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-subtle)] px-3 py-2 text-xs font-medium text-[var(--status-warning-text)]"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Kết nối CVAT chỉ dùng trong app Windows.</span>
          </div>
        )}

        {/* Step 2: Task & Job Selector */}
        <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleListTasks}
              disabled={isLoading || !desktopAvailable}
              className="dt-btn dt-btn-secondary shrink-0"
            >
              {isLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
              Lấy danh sách Task
            </button>

            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <span className="w-9 shrink-0">Task</span>
              {tasks.length > 0 ? (
                <select
                  value={taskId}
                  onChange={(event) => void handleTaskChange(event.target.value)}
                  disabled={isLoading || !desktopAvailable}
                  className="dt-select min-w-0 flex-1"
                >
                  {tasks.map(task => <option key={task.id} value={task.id}>#{task.id} — {task.name}</option>)}
                </select>
              ) : (
                <input
                  value={taskId}
                  onChange={(event) => setTaskId(event.target.value)}
                  placeholder="Nhập Task ID"
                  inputMode="numeric"
                  disabled={isLoading || !desktopAvailable}
                  className="dt-input min-w-0 flex-1 dt-mono"
                />
              )}
            </label>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <span className="w-9 shrink-0">Job</span>
              {jobs.length > 0 ? (
                <select
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  disabled={isLoading || !desktopAvailable}
                  className="dt-select min-w-0 flex-1"
                >
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      #{job.id} — Frame {job.start_frame ?? '?'}–{job.stop_frame ?? '?'}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  placeholder="Job ID hoặc link Job trên server đang chọn"
                  inputMode="text"
                  disabled={isLoading || !desktopAvailable}
                  className="dt-input min-w-0 flex-1 dt-mono"
                />
              )}
            </label>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void handleLoad(false)}
                disabled={isLoading || !desktopAvailable}
                className="dt-btn dt-btn-primary"
              >
                <KeyRound className="h-3.5 w-3.5" /> Mở Job
              </button>
              <button
                type="button"
                onClick={() => void handleLoad(true)}
                disabled={isLoading || !desktopAvailable}
                className="dt-btn dt-btn-secondary"
              >
                <CloudDownload className="h-3.5 w-3.5" /> Mở Task
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-3 py-2 text-xs font-medium text-[var(--status-danger-text)]"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
