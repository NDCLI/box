const crypto = require('node:crypto');
const { ImageViewCache } = require('./imageview-cache.cjs');

function createImageViewService({ cacheDirectory, tokenForServer, fetchImpl = fetch }) {
  const cache = new ImageViewCache(cacheDirectory);
  const sessions = new Map();
  let cacheGeneration = 0;
  let activeDownloads = 0;
  const waiting = [];
  const inflight = new Map();
  const pump = () => {
    while (activeDownloads < 3 && waiting.length) {
      const entry = waiting.shift();
      entry.signal.removeEventListener('abort', entry.abort);
      if (entry.signal.aborted) { entry.reject(new DOMException('Cancelled', 'AbortError')); continue; }
      activeDownloads++;
      entry.resolve(() => { activeDownloads--; pump(); });
    }
  };
  function slot(priority, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const entry = { signal, resolve, reject, priority, abort: () => {
        const index = waiting.indexOf(entry); if (index >= 0) waiting.splice(index, 1);
        reject(new DOMException('Cancelled', 'AbortError'));
      } };
      signal.addEventListener('abort', entry.abort, { once: true });
      const index = priority ? waiting.findIndex(item => !item.priority) : -1;
      if (index < 0) waiting.push(entry); else waiting.splice(index, 0, entry);
      pump();
    });
  }
  const frameKey = (session, frame) => JSON.stringify([session.scope, session.taskId, session.jobId, session.revision, frame, 'compressed']);

  function sessionFor(owner, id) {
    const session = sessions.get(id);
    if (!session || session.owner !== owner) throw new Error('Phiên ImageView đã đóng. Hãy mở lại Job.');
    return session;
  }

  function close(owner, id) {
    if (!sessions.has(id)) return;
    const session = sessionFor(owner, id);
    if (session.preload) session.preload.stopped = true;
    cache.release(id);
    sessions.delete(id);
    for (const controller of session.requests.values()) controller.abort();
    session.requests.clear();
  }

  async function authorized(session, force = false) {
    if (!force && Date.now() - session.validatedAt < 60_000) return;
    if (!session.validation) {
      session.validation = (async () => {
        const resource = session.jobId ? `jobs/${session.jobId}` : `tasks/${session.taskId}`;
        const response = await fetchImpl(`${session.base}/${resource}`, { headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(20_000) });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            cacheGeneration++;
            for (const [id, other] of sessions) if (other.scope === session.scope) close(other.owner, id);
            await cache.manage({ action: 'clear' });
          }
          throw new Error(`Không xác thực được quyền đọc CVAT (${response.status}).`);
        }
        const data = await response.json();
        if (session.jobId && data.task_id !== session.taskId) throw new Error('Job không thuộc Task đã chọn.');
        session.start = session.jobId ? data.start_frame : 0;
        session.stop = session.jobId ? data.stop_frame : Number.MAX_SAFE_INTEGER;
        session.validatedAt = Date.now();
      })().finally(() => { session.validation = null; });
    }
    await session.validation;
  }

  const api = {
    async open(owner, request) {
      const url = new URL(request.serverUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('URL CVAT không hợp lệ.');
      const taskId = Number(request.taskId);
      const jobId = request.jobId == null ? undefined : Number(request.jobId);
      if (!Number.isSafeInteger(taskId) || taskId < 1 || (jobId !== undefined && (!Number.isSafeInteger(jobId) || jobId < 1))) throw new Error('Task/Job ID không hợp lệ.');
      if (!Array.isArray(request.frames) || request.frames.some(frame => !Number.isSafeInteger(frame) || frame < 0)) throw new Error('Danh sách frame không hợp lệ.');
      if (typeof request.revision !== 'string' || request.revision.length > 50_000_000) throw new Error('Revision không hợp lệ.');
      const token = String(request.token || tokenForServer(request.serverUrl) || '').trim();
      if (!token) throw new Error('Thiếu PAT CVAT.');
      const base = url.toString().replace(/\/+$/, '').replace(/\/api$/, '') + '/api';
      const scope = crypto.createHash('sha256').update(`${base}\0${token}`).digest('hex');
      const session = { owner, base, taskId, jobId, token, scope, revision: crypto.createHash('sha256').update(request.revision).digest('hex'),
        frames: new Set(request.frames), requests: new Map(), validatedAt: 0, validation: null };
      await authorized(session, true);
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, session);
      return { sessionId };
    },

    async frame(owner, request) {
      const session = sessionFor(owner, request.sessionId);
      if (typeof request.requestId !== 'string' || request.requestId.length > 100 || session.requests.has(request.requestId)) throw new Error('Request ID không hợp lệ.');
      if (!session.frames.has(request.frameId)) throw new Error('Frame không thuộc phiên đang xem.');
      const controller = new AbortController();
      session.requests.set(request.requestId, controller);
      const generation = cacheGeneration;
      let release;
      let unlock;
      let lockedKey;
      try {
        await authorized(session);
        sessionFor(owner, request.sessionId);
        controller.signal.throwIfAborted();
        if (request.frameId < session.start || request.frameId > session.stop) throw new Error('Frame ngoài phạm vi Job.');
        const key = frameKey(session, request.frameId);
        const cached = await cache.read(key).catch(() => null);
        controller.signal.throwIfAborted();
        if (cached) return cached;
        while (inflight.has(key)) {
          await inflight.get(key);
          controller.signal.throwIfAborted();
          const shared = await cache.read(key).catch(() => null);
          if (shared) return shared;
        }
        lockedKey = key;
        inflight.set(key, new Promise(resolve => { unlock = resolve; }));
        release = await slot(request.priority === true, controller.signal);
        controller.signal.throwIfAborted();
        const shared = await cache.read(key).catch(() => null);
        if (shared) return shared;
        const endpoint = session.jobId ? `jobs/${session.jobId}` : `tasks/${session.taskId}`;
        const response = await fetchImpl(`${session.base}/${endpoint}/data?type=frame&number=${request.frameId}&quality=compressed`, {
          headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            cacheGeneration++;
            for (const [id, other] of sessions) if (other.scope === session.scope) close(other.owner, id);
            await cache.manage({ action: 'clear' });
          }
          throw new Error(`Không tải được ảnh CVAT (${response.status}).`);
        }
        const contentType = response.headers.get('content-type')?.split(';')[0] || '';
        if (!contentType.startsWith('image/')) throw new Error('CVAT không trả về dữ liệu ảnh hợp lệ.');
        const data = Buffer.from(await response.arrayBuffer());
        if (!data.length) throw new Error('CVAT trả ảnh rỗng.');
        controller.signal.throwIfAborted();
        const write = cache.write(key, { data, contentType }, () => generation === cacheGeneration && !controller.signal.aborted && sessions.has(request.sessionId));
        if (request.requireCache) await write; else await write.catch(() => {});
        controller.signal.throwIfAborted();
        return { data, contentType };
      } finally {
        if (unlock) { inflight.delete(lockedKey); unlock(); }
        release?.(); session.requests.delete(request.requestId);
      }
    },

    preload(owner, id) {
      const session = sessionFor(owner, id);
      if (session.preload) return { ...session.preload };
      const progress = session.preload = { state: 'running', total: session.frames.size, completed: 0, failed: 0, message: '', stopped: false };
      cache.protect(id, [...session.frames].map(frame => frameKey(session, frame)));
      void (async () => {
        try {
          // One background download leaves capacity for interactive frame requests.
          for (const frameId of session.frames) {
            if (progress.stopped || !sessions.has(id)) break;
            await api.frame(owner, { sessionId: id, requestId: `preload-${crypto.randomUUID()}`, frameId, priority: false, requireCache: true });
            progress.completed++;
            await new Promise(resolve => setTimeout(resolve, 5));
          }
          progress.state = progress.stopped ? 'stopped' : 'complete';
        } catch (error) {
          progress.state = progress.stopped ? 'stopped' : 'error';
          progress.failed++;
          progress.message = error.message;
          cache.release(id);
        }
      })();
      return { ...progress };
    },
    preloadStatus(owner, id) {
      return { ...(sessionFor(owner, id).preload || { state: 'idle', total: 0, completed: 0, failed: 0, message: '' }) };
    },
    frameForRequest(owner, request) {
      const base = new URL(request.serverUrl).toString().replace(/\/+$/, '').replace(/\/api$/, '') + '/api';
      const frameId = Number(request.frameId);
      for (const [sessionId, session] of sessions) {
        const sameScope = request.resource === 'jobFrame' ? session.jobId === Number(request.jobId)
          : !session.jobId && session.taskId === Number(request.taskId);
        if (session.owner === owner && session.base === base && session.token === request.token && sameScope && session.frames.has(frameId)) {
          return api.frame(owner, { sessionId, frameId, requestId: crypto.randomUUID(), priority: true });
        }
      }
      return null;
    },

    cancel(owner, request) { if (sessions.has(request.sessionId)) sessionFor(owner, request.sessionId).requests.get(request.requestId)?.abort(); },
    close,
    closeOwner(owner) { for (const [id, session] of sessions) if (session.owner === owner) close(owner, id); },
    async manage(request) {
      if (request.action === 'clear' || request.action === 'configure') {
        cacheGeneration++;
        for (const [id, session] of sessions) {
          if (session.preload?.state === 'running') {
            session.preload.stopped = true; session.preload.state = 'stopped';
            for (const [key, controller] of session.requests) if (key.startsWith('preload-')) controller.abort();
          }
          cache.release(id);
        }
      }
      return cache.manage(request);
    },
  };
  return api;
}

function registerImageView({ ipcMain, app, path, tokenForServer }) {
  let service;
  const watched = new WeakSet();
  const get = () => service ||= createImageViewService({ cacheDirectory: path.join(app.getPath('userData'), 'cache', 'imageview-v1'), tokenForServer });
  ipcMain.handle('viewer:open', async (event, request) => {
    const result = await get().open(event.sender.id, request);
    if (event.sender.isDestroyed()) { get().close(event.sender.id, result.sessionId); throw new Error('Window closed'); }
    if (!watched.has(event.sender)) {
      watched.add(event.sender);
      const owner = event.sender.id;
      event.sender.once('destroyed', () => get().closeOwner(owner));
    }
    return result;
  });
  ipcMain.handle('viewer:frame', async (event, request) => {
    try { return await get().frame(event.sender.id, request); }
    catch (error) { if (error.name === 'AbortError') return { cancelled: true }; throw error; }
  });
  ipcMain.handle('viewer:cancel', (event, request) => get().cancel(event.sender.id, request));
  ipcMain.handle('viewer:close', (event, id) => get().close(event.sender.id, id));
  ipcMain.handle('viewer:cache', (_event, request) => get().manage(request));
  ipcMain.handle('viewer:preload', (event, id) => get().preload(event.sender.id, id));
  ipcMain.handle('viewer:preload-status', (event, id) => get().preloadStatus(event.sender.id, id));
  return { frameForRequest: (owner, request) => get().frameForRequest(owner, request) };
}

module.exports = { createImageViewService, registerImageView };
