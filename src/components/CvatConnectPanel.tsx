import { CloudDownload, KeyRound, ListChecks, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { CVATDataset } from '../types';
import { listCvatTasks, loadCvatTaskDataset, type CvatConnection, type CvatTaskSummary } from '../utils/cvatApi';

interface CvatConnectPanelProps {
  onDatasetLoaded: (dataset: CVATDataset, connection: CvatConnection, taskId: number) => void;
}

export default function CvatConnectPanel({ onDatasetLoaded }: CvatConnectPanelProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [tasks, setTasks] = useState<CvatTaskSummary[]>([]);
  const [taskId, setTaskId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = (): CvatConnection => ({ serverUrl, token });

  const handleListTasks = async () => {
    if (!serverUrl.trim() || !token.trim()) {
      setError('Nhập URL CVAT và Personal Access Token trước.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const loadedTasks = await listCvatTasks(connection());
      setTasks(loadedTasks);
      setTaskId(loadedTasks[0] ? String(loadedTasks[0].id) : '');
      if (loadedTasks.length === 0) setError('Không tìm thấy Task nào mà token có quyền đọc.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối tới CVAT. Kiểm tra URL, token và CORS.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTask = async () => {
    const id = Number(taskId);
    if (!Number.isInteger(id) || id < 1) {
      setError('Chọn hoặc nhập Task ID hợp lệ.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const activeConnection = connection();
      onDatasetLoaded(await loadCvatTaskDataset(activeConnection, id), activeConnection, id);
      setToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải annotation từ CVAT.');
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
          <p className="mt-0.5 text-xs text-slate-500">Token chỉ dùng trong phiên này để đọc Task, không được lưu trên thiết bị.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          URL CVAT
          <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="https://cvat.example.com" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" autoComplete="url" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Personal Access Token (Read Only)
          <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Dán token CVAT" type="password" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" autoComplete="off" />
        </label>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={handleListTasks} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-60">
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
          Lấy danh sách Task
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-slate-600">
          Task
          {tasks.length > 0 ? (
            <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {tasks.map(task => <option key={task.id} value={task.id}>#{task.id} — {task.name}</option>)}
            </select>
          ) : (
            <input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="Nhập Task ID" inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          )}
        </label>
        <button type="button" onClick={handleLoadTask} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
          <KeyRound className="h-4 w-4" /> Tải annotation
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}
    </section>
  );
}
