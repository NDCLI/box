import { useEffect, useState } from 'react';
import type { CVATDataset } from '../types';
import type { CvatFrameSource } from './useFrameImage';
import type { JobCacheProgress } from '../utils/cvatApi';
import { cvatSessionRequest } from '../imageview/sources';

export function useJobImageCache(dataset: CVATDataset | null, source: CvatFrameSource | null) {
  const [progress, setProgress] = useState<JobCacheProgress | null>(null);
  useEffect(() => {
    setProgress(null);
    const desktop = window.cvatDesktop;
    if (source?.connection.mode !== 'electron' || !source.jobId || !dataset?.viewerPayload || !desktop?.viewerOpen || !desktop.viewerPreload || !desktop.viewerPreloadStatus) return;
    let disposed = false;
    let sessionId: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reportError = (error: unknown) => {
      if (!disposed) setProgress(current => ({ state: 'error', total: current?.total || 0, completed: current?.completed || 0,
        failed: 1, message: error instanceof Error ? error.message : String(error) }));
    };
    const poll = async () => {
      try {
        const next = await desktop.viewerPreloadStatus!(sessionId!);
        if (disposed) return;
        setProgress(next);
        if (next.state === 'running') timer = setTimeout(() => void poll(), 750);
      } catch (error) { reportError(error); }
    };
    void (async () => {
      const result = await desktop.viewerOpen!(cvatSessionRequest(source.connection as Extract<typeof source.connection, { mode: 'electron' }>, source.taskId, source.jobId, dataset.viewerPayload!));
      sessionId = result.sessionId;
      if (disposed) { await desktop.viewerClose?.(sessionId); return; }
      const initial = await desktop.viewerPreload!(sessionId);
      if (disposed) return;
      setProgress(initial);
      await poll();
    })().catch(reportError);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (sessionId) void desktop.viewerClose?.(sessionId).catch(() => {});
    };
  }, [dataset, source]);
  return progress;
}
