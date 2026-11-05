import { loadCvatViewerPayload, type CvatConnection } from '../utils/cvatApi';
import { mapViewerPayload, sortByImageName, type ViewerPayload } from './metadata';
import type { CVATDataset } from '../types';
import { createImageQueue } from './queue';
import type { ViewerSource, ViewerImage, ViewerAnnotation } from './types';
import { openZip } from './solid/lib/zip-loader.js';
import { parseAnnotations } from './solid/lib/annotations.js';

function resume(source: ViewerSource, id: string): ViewerSource {
  const storageKey = `imageview-position:${id}`;
  try {
    const key = localStorage.getItem(storageKey);
    source.initialIndex = Math.max(0, source.images.findIndex(image => image.key === key));
  } catch { /* Storage is optional. */ }
  source.onIndexChange = index => {
    source.initialIndex = index;
    try { if (source.images[index]) localStorage.setItem(storageKey, source.images[index].key); } catch { /* Storage is optional. */ }
  };
  return source;
}

export async function createZipSource(file: File, dataset?: CVATDataset): Promise<ViewerSource> {
  const zip = await openZip(file);
  try {
    const parsed = (zip.annotationsText ? parseAnnotations(zip.annotationsText) : { labels: {}, images: {}, jobId: '' }) as {
      labels: Record<string, string>; images: Record<string, ViewerAnnotation>; jobId?: string;
    };
    const images = sortByImageName<ViewerImage>((zip.paths as string[]).filter(name => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)).map(name => {
      const annotation = parsed.images[name] ?? parsed.images[name.split('/').pop()!];
      return { id: name, key: name, name, frameId: annotation?.id != null ? Number(annotation.id) : undefined,
        width: annotation?.width || 0, height: annotation?.height || 0 };
    }));
    if (dataset) {
      const shared: Record<string, ViewerAnnotation> = Object.create(null);
      for (const image of images) {
        const matches = dataset.frames.filter(frame => image.name === frame.name || image.name.endsWith(`/${frame.name}`));
        const frame = matches.length === 1 ? matches[0] : undefined;
        if (!frame) continue;
        image.frameId = Number(frame.id);
        image.width = frame.width; image.height = frame.height;
        shared[image.key] = { id: frame.id, width: frame.width, height: frame.height, boxes: frame.boxes.filter(box => !box.outside && box.serverPayload?.type !== 'mask') };
      }
      parsed.images = shared;
      parsed.labels = dataset.labelColors || parsed.labels;
    }
    const queue = createImageQueue(1);
    return resume({ title: file.name, images, annotations: { ...parsed, jobId: parsed.jobId ? Number(parsed.jobId) : undefined },
      getImage: (key, options) => queue.run(async () => {
        const blob = await zip.getBlob(key, { priority: options.priority });
        options.signal.throwIfAborted();
        return blob;
      }, options.priority, options.signal), dispose: () => zip.terminate() }, `zip:${file.name}:${file.size}:${file.lastModified}`);
  } catch (error) { zip.terminate(); throw error; }
}

export function cvatSessionRequest(connection: Extract<CvatConnection, { mode: 'electron' }>, taskId: number, jobId: number | undefined, payload: ViewerPayload) {
  const mapped = mapViewerPayload(payload);
  // Annotation edits do not invalidate image bytes. The metadata describes image identity.
  const revision = JSON.stringify(['images-v2', payload.meta.chunks_updated_date,
    mapped.images.map(image => [image.frameId, image.name, image.width, image.height])]);
  return { serverUrl: connection.serverUrl, token: connection.token, taskId, jobId, revision, frames: mapped.images.map(image => image.frameId!) };
}

export async function createCvatSource(connection: CvatConnection, taskId: number, jobId?: number, sharedPayload?: ViewerPayload): Promise<ViewerSource> {
  if (connection.mode !== 'electron' || !window.cvatDesktop?.viewerOpen || !window.cvatDesktop.viewerFrame) {
    throw new Error('Hãy mở bản desktop CVAT Tools có ImageView.');
  }
  const payload = sharedPayload ?? await loadCvatViewerPayload(connection, taskId, jobId);
  const mapped = mapViewerPayload(payload);
  const desktop = window.cvatDesktop;
  const { sessionId } = await desktop.viewerOpen!(cvatSessionRequest(connection, taskId, jobId, payload));
  const queue = createImageQueue();
  const liveRequests = new Map<string, AbortController>();
  let disposed = false;
  return resume({ ...mapped, title: `${payload.task.name}${jobId ? ` — Job #${jobId}` : ` — Task #${taskId}`}`,
    getImage: (key, options) => {
      if (disposed) return Promise.reject(new DOMException('Session closed', 'AbortError'));
      const requestId = crypto.randomUUID();
      const controller = new AbortController();
      const abort = () => { controller.abort(); void desktop.viewerCancel?.({ sessionId, requestId }).catch(() => {}); };
      options.signal.addEventListener('abort', abort, { once: true });
      if (options.signal.aborted) abort();
      liveRequests.set(requestId, controller);
      return queue.run(async () => {
        const result = await desktop.viewerFrame!({ sessionId, requestId, frameId: Number(key), priority: options.priority });
        controller.signal.throwIfAborted();
        return new Blob([result.data as Uint8Array<ArrayBuffer>], { type: result.contentType });
      }, options.priority, controller.signal).finally(() => {
        options.signal.removeEventListener('abort', abort);
        liveRequests.delete(requestId);
      });
    },
    dispose: () => {
      disposed = true;
      for (const controller of liveRequests.values()) controller.abort();
      liveRequests.clear();
      void desktop.viewerClose?.(sessionId).catch(() => {});
    },
  }, `cvat:${connection.serverUrl}:${taskId}:${jobId ?? 'task'}`);
}
