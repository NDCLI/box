import type { ViewerAnnotation, ViewerImage } from './types';

export interface ViewerMeta {
  frames: { name?: string; width: number; height: number }[];
  size?: number;
  start_frame?: number;
  stop_frame?: number;
  frame_filter?: string;
  included_frames?: number[] | null;
  deleted_frames?: number[];
  chunks_updated_date?: string;
}

interface Shape { frame: number; type: string; points: number[]; label_id: number; outside?: boolean }
export interface ViewerPayload {
  task: { id: number; name: string; size?: number; mode?: string; updated_date?: string };
  job?: { id: number; start_frame: number; stop_frame: number; updated_date?: string };
  meta: ViewerMeta;
  jobMeta?: ViewerMeta;
  labels: { id: number; name: string; color?: string }[];
  annotations: { shapes?: Shape[]; tracks?: unknown[] };
}

// Match ImageView main's ZIP ordering exactly; do not enable numeric/natural sort.
export function sortByImageName<T extends { name: string }>(images: T[]): T[] {
  return [...images].sort((a, b) => a.name.localeCompare(b.name));
}

export function mapViewerPayload(payload: ViewerPayload) {
  const { task, job, meta, jobMeta, labels, annotations } = payload;
  const start = meta.start_frame ?? 0;
  const step = Number(meta.frame_filter?.match(/(?:^|[,\s])step\s*=\s*(\d+)/)?.[1] ?? 1);
  if (!Number.isSafeInteger(step) || step < 1) throw new Error('Frame step CVAT không hợp lệ.');
  const deleted = new Set([...(meta.deleted_frames ?? []), ...(jobMeta?.deleted_frames ?? [])]);
  const included = jobMeta?.included_frames ? new Set(jobMeta.included_frames) : null;
  const video = task.mode === 'interpolation';
  const count = video ? (task.size ?? meta.size ?? 0) : meta.frames.length;
  const records: ViewerImage[] = [];
  let missingNames = false;
  for (let index = 0; index < count; index++) {
    const dataFrame = meta.included_frames?.[index] ?? start + index * step;
    const frameId = (dataFrame - start) / step;
    if (!Number.isSafeInteger(frameId) || frameId < 0) throw new Error('Không ánh xạ được Frame ID CVAT.');
    if (job && (frameId < job.start_frame || frameId > job.stop_frame)) continue;
    if (deleted.has(frameId) || (included && !included.has(dataFrame))) continue;
    const info = meta.frames[video ? 0 : index];
    const name = video ? `frame_${String(frameId).padStart(9, '0')}` : info?.name;
    if (!name) missingNames = true;
    records.push({ id: String(frameId), key: String(frameId), frameId,
      name: name || `Frame ${frameId} (thiếu tên)`, width: info?.width ?? 0, height: info?.height ?? 0 });
  }
  const byFrame = new Map(records.map(record => [record.frameId, record]));
  const images: Record<string, ViewerAnnotation> = Object.create(null);
  for (const record of records) images[record.key] = { id: record.frameId!, width: record.width, height: record.height, boxes: [] };
  const labelNames = new Map(labels.map(label => [label.id, label.name]));
  for (const shape of annotations.shapes ?? []) {
    const record = byFrame.get(shape.frame);
    if (!record || shape.type !== 'rectangle' || shape.outside || shape.points.length < 4 || !shape.points.every(Number.isFinite)) continue;
    const [xtl, ytl, xbr, ybr] = shape.points;
    images[record.key].boxes.push({ label: labelNames.get(shape.label_id) ?? `label_${shape.label_id}`, xtl, ytl, xbr, ybr });
  }
  const warnings = [missingNames ? 'Một số frame không có tên trong metadata CVAT.' : '',
    annotations.tracks?.length ? 'Job có Track: viewer chỉ hiển thị Rectangle Shape, chưa nội suy Track.' : ''];
  return { images: sortByImageName(records), annotations: { images, labels: Object.fromEntries(labels.map(label => [label.name, label.color || '#ff0000'])), jobId: job?.id }, warning: warnings.filter(Boolean).join(' ') };
}
