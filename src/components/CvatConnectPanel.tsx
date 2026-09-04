import { CloudDownload, KeyRound, ListChecks, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { CVATDataset } from '../types';
import { listCvatJobs, listCvatTasks, loadCvatJobDataset, type CvatConnection, type CvatJobSummary, type CvatTaskSummary } from '../utils/cvatApi';

interface CvatConnectPanelProps {
  onDatasetLoaded: (dataset: CVATDataset, connection: CvatConnection, taskId: number, jobId?: number) => void;
}

export default function CvatConnectPanel({ onDatasetLoaded }: CvatConnectPanelProps) {
  const desktopAvailable = Boolean(window.cvatDesktop);
  const [connectionMode, setConnectionMode] = useState<'vercel' | 'direct' | 'electron'>(desktopAvailable ? 'electron' : 'vercel');
  const [serverUrl, setServerUrl] = useState('http://10.43.2.147:8080');
  const [token, setToken] = useState('');
  const [tasks, setTasks] = useState<CvatTaskSummary[]>([]);
  const [taskId, setTaskId] = useState('');
  const [jobs, setJobs] = useState<CvatJobSummary[]>([]);
  const [jobId, setJobId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = (): CvatConnection => connectionMode === 'vercel'
    ? { mode: 'vercel' }
    : { mode: connectionMode, serverUrl, token };

  const handleListTasks = async () => {
    if (connectionMode !== 'vercel' && (!serverUrl.trim() || !token.trim())) {
      setError('Nhập URL CVAT và Personal Access Token trước.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const loadedTasks = await listCvatTasks(connection());
      setTasks(loadedTasks);
      setTaskId(loadedTasks[0] ? String(loadedTasks[0].id) : '');
      setJobs([]);
      setJobId('');
      if (loadedTasks.length === 0) setError('Không tìm thấy Task nào mà token có quyền đọc.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối tới CVAT. Kiểm tra cấu hình Vercel hoặc CORS.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleListJobs = async () => {
    const id = Number(taskId);
    if (!Number.isInteger(id) || id < 1) {
      setError('Chọn hoặc nhập Task ID hợp lệ.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const loadedJobs = await listCvatJobs(connection(), id);
      setJobs(loadedJobs);
      setJobId(loadedJobs[0] ? String(loadedJobs[0].id) : '');
      if (loadedJobs.length === 0) setError('Task này không có Job nào mà token có quyền đọc.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách Job từ CVAT.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadJob = async () => {
    const activeTaskId = Number(taskId);
    const activeJobId = Number(jobId);
    if (!Number.isInteger(activeTaskId) || activeTaskId < 1 || !Number.isInteger(activeJobId) || activeJobId < 1) {
      setError('Chọn Task và Job hợp lệ.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const activeConnection = connection();
      onDatasetLoaded(await loadCvatJobDataset(activeConnection, activeTaskId, activeJobId), activeConnection, activeTaskId, activeJobId);
      if (connectionMode !== 'vercel') setToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải annotation Job từ CVAT.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-xs">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><CloudDownload className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">Đọc trực tiếp từ CVAT</h2>
          <p className="mt-0.5 text-xs text-slate-500">Dùng token Vercel hoặc PAT chỉ đọc để lấy Task.</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 rounded-lg bg-slate-100 p-1">
        <button type="button" onClick={() => setConnectionMode('vercel')} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${connectionMode === 'vercel' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Dùng token Vercel</button>
        {desktopAvailable && <button type="button" onClick={() => setConnectionMode('electron')} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${connectionMode === 'electron' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>App Windows (LAN)</button>}
        <button type="button" onClick={() => setConnectionMode('direct')} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold ${connectionMode === 'direct' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Dán PAT tạm thời</button>
      </div>

      {connectionMode === 'vercel' ? (
        <p className="mt-3 text-xs text-slate-500">Token được giữ kín trong Vercel; ứng dụng chỉ gọi API nội bộ.</p>
      ) : (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          URL CVAT
          <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="https://cvat.example.com" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" autoComplete="url" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Personal Access Token (Read Only)
          <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Dán token CVAT" type="password" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" autoComplete="off" />
        </label>
      </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={handleListTasks} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60">
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
          Lấy danh sách Task
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-slate-600">
          Task
          {tasks.length > 0 ? (
            <select value={taskId} onChange={(event) => { setTaskId(event.target.value); setJobs([]); setJobId(''); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {tasks.map(task => <option key={task.id} value={task.id}>#{task.id} — {task.name}</option>)}
            </select>
          ) : (
            <input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="Nhập Task ID" inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          )}
        </label>
        <button type="button" onClick={handleListJobs} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60">
          <ListChecks className="h-4 w-4" /> Lấy danh sách Job
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-slate-600">
          Job
          {jobs.length > 0 ? (
            <select value={jobId} onChange={(event) => setJobId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {jobs.map(job => <option key={job.id} value={job.id}>#{job.id} — Frame {job.start_frame ?? '?'}–{job.stop_frame ?? '?'}</option>)}
            </select>
          ) : (
            <input value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="Lấy danh sách hoặc nhập Job ID" inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          )}
        </label>
        <button type="button" onClick={handleLoadJob} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
          <KeyRound className="h-4 w-4" /> Tải annotation Job
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}
    </section>
  );
}
