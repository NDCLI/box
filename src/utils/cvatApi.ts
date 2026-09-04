import type { CVATAttribute, CVATBox, CVATDataset, CVATFrameData } from '../types';

export interface DirectCvatConnection {
  mode: 'direct';
  serverUrl: string;
  token: string;
}

export interface VercelCvatConnection {
  mode: 'vercel';
}

export interface ElectronCvatConnection extends Omit<DirectCvatConnection, 'mode'> {
  mode: 'electron';
}

export type CvatConnection = DirectCvatConnection | VercelCvatConnection | ElectronCvatConnection;

type CvatResource = 'tasks' | 'task' | 'annotations' | 'frame' | 'jobs' | 'job' | 'jobAnnotations' | 'jobFrame' | 'labels';

interface DesktopCvatResponse {
  status: number;
  contentType?: string;
  data: unknown;
}

declare global {
  interface Window {
    cvatDesktop?: {
      request: (request: { resource: CvatResource; serverUrl: string; token: string; taskId?: number; jobId?: number; frameId?: string }) => Promise<DesktopCvatResponse>;
    };
  }
}

export interface CvatTaskSummary {
  id: number;
  name: string;
}

export interface CvatJobSummary {
  id: number;
  start_frame?: number;
  stop_frame?: number;
}

interface CvatAttributeSpec {
  id: number;
  name: string;
}

interface CvatLabel {
  id: number;
  name: string;
  color?: string;
  attributes?: CvatAttributeSpec[];
}

interface CvatTask extends CvatTaskSummary {
  size?: number;
  labels?: unknown;
}

interface CvatJob extends CvatJobSummary {
  task_id?: number;
}

interface CvatShape {
  id?: number;
  label_id: number;
  frame: number;
  type: string;
  points: number[];
  occluded?: boolean;
  z_order?: number;
  group?: number;
  source?: string;
  outside?: boolean;
  keyframe?: boolean;
  attributes?: { spec_id: number; value: string }[];
}

interface CvatTrack {
  id: number;
  label_id: number;
  attributes?: { spec_id: number; value: string }[];
  shapes?: CvatShape[];
}

interface CvatAnnotations {
  shapes?: CvatShape[];
  tracks?: CvatTrack[];
}

function normalizeLabels(value: unknown): CvatLabel[] {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { results?: unknown }).results)
      ? (value as { results: unknown[] }).results
      : value && typeof value === 'object'
        ? Object.values(value)
        : [];

  return candidates.filter((label): label is CvatLabel => (
    Boolean(label) && typeof label === 'object' &&
    typeof (label as CvatLabel).id === 'number' &&
    typeof (label as CvatLabel).name === 'string'
  ));
}

function apiBaseUrl(serverUrl: string): string {
  const normalized = serverUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('URL CVAT phải bắt đầu bằng http:// hoặc https://.');
  }
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

async function cvatFetch<T>(connection: CvatConnection, path: string): Promise<T> {
  if (connection.mode === 'electron') {
    const response = await requestDesktop(connection, requestFromPath(path));
    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.status === 401 || response.status === 403
        ? 'PAT không hợp lệ, đã hết hạn hoặc không có quyền đọc CVAT.'
        : `CVAT trả về lỗi ${response.status}.`);
    }
    return response.data as T;
  }

  const response = await fetch(connection.mode === 'vercel' ? proxyUrl(path) : `${apiBaseUrl(connection.serverUrl)}${path}`, {
    headers: {
      Accept: 'application/vnd.cvat+json, application/json',
      ...(connection.mode === 'direct' ? { Authorization: `Bearer ${connection.token.trim()}` } : {}),
    },
  });

  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? 'Token không có quyền đọc Task này.'
      : `CVAT trả về lỗi ${response.status}.`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function requestFromPath(path: string): { resource: Exclude<CvatResource, 'frame' | 'jobFrame'>; taskId?: number; jobId?: number } {
  if (path === '/tasks?page_size=1000') return { resource: 'tasks' };
  const jobsMatch = path.match(/^\/jobs\?task_id=(\d+)&page_size=1000$/);
  if (jobsMatch) return { resource: 'jobs', taskId: Number(jobsMatch[1]) };
  const labelsMatch = path.match(/^\/labels\?task_id=(\d+)&page_size=1000$/);
  if (labelsMatch) return { resource: 'labels', taskId: Number(labelsMatch[1]) };
  const jobMatch = path.match(/^\/jobs\/(\d+)(\/annotations)?$/);
  if (jobMatch) return { resource: jobMatch[2] ? 'jobAnnotations' : 'job', jobId: Number(jobMatch[1]) };
  const match = path.match(/^\/tasks\/(\d+)(\/annotations)?$/);
  if (!match) throw new Error('Yêu cầu CVAT không được hỗ trợ.');
  return { resource: match[2] ? 'annotations' : 'task', taskId: Number(match[1]) };
}

async function requestDesktop(
  connection: ElectronCvatConnection,
  request: { resource: CvatResource; taskId?: number; jobId?: number; frameId?: string },
): Promise<DesktopCvatResponse> {
  if (!window.cvatDesktop) throw new Error('Hãy chạy tính năng này trong app Windows.');
  return window.cvatDesktop.request({ ...request, serverUrl: connection.serverUrl.trim(), token: connection.token.trim() });
}

export async function listCvatTasks(connection: CvatConnection): Promise<CvatTaskSummary[]> {
  const data = await cvatFetch<CvatTaskSummary[] | { results?: CvatTaskSummary[] }>(connection, '/tasks?page_size=1000');
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function listCvatJobs(connection: CvatConnection, taskId: number): Promise<CvatJobSummary[]> {
  const data = await cvatFetch<CvatJobSummary[] | { results?: CvatJobSummary[] }>(connection, `/jobs?task_id=${taskId}&page_size=1000`);
  return Array.isArray(data) ? data : data.results ?? [];
}

async function listCvatTaskLabels(connection: CvatConnection, taskId: number): Promise<CvatLabel[]> {
  try {
    const data = await cvatFetch<CvatLabel[] | { results?: CvatLabel[] }>(connection, `/labels?task_id=${taskId}&page_size=1000`);
    return normalizeLabels(Array.isArray(data) ? data : data.results);
  } catch {
    return [];
  }
}

function toAttributes(
  values: { spec_id: number; value: string }[] | undefined,
  attributeNames: Map<number, string>,
): CVATAttribute[] {
  return (values ?? []).map(value => ({
    name: attributeNames.get(value.spec_id) ?? `attribute_${value.spec_id}`,
    value: value.value,
  }));
}

export function toCvatDataset(task: CvatTask, annotations: CvatAnnotations, frameRange?: CvatJobSummary): CVATDataset {
  const labels = normalizeLabels(task.labels);
  const labelsById = new Map(labels.map(label => [label.id, label]));
  const attributeNames = new Map<number, string>();
  labels.forEach(label => label.attributes?.forEach(attribute => attributeNames.set(attribute.id, attribute.name)));

  const frameMap = new Map<string, CVATFrameData>();
  const getFrame = (frameId: number): CVATFrameData => {
    const id = String(frameId);
    let frame = frameMap.get(id);
    if (!frame) {
      frame = { id, name: `Frame ${id}`, width: 0, height: 0, boxes: [] };
      frameMap.set(id, frame);
    }
    return frame;
  };

  let globalIndex = 1;
  const addShape = (shape: CvatShape, trackId?: number, trackAttributes?: { spec_id: number; value: string }[]) => {
    if (shape.type !== 'rectangle' || shape.outside || shape.points.length < 4) return;
    const label = labelsById.get(shape.label_id)?.name ?? `label_${shape.label_id}`;
    const [xtl, ytl, xbr, ybr] = shape.points;
    const frame = getFrame(shape.frame);
    frame.width = Math.max(frame.width, Math.ceil(xbr));
    frame.height = Math.max(frame.height, Math.ceil(ybr));
    const box: CVATBox = {
      id: String(shape.id ?? `${trackId ?? 'shape'}-${shape.frame}-${globalIndex}`),
      label,
      xtl,
      ytl,
      xbr,
      ybr,
      occluded: Boolean(shape.occluded),
      z_order: shape.z_order,
      group_id: shape.group,
      source: shape.source,
      outside: shape.outside,
      keyframe: shape.keyframe,
      trackId: trackId === undefined ? undefined : String(trackId),
      attributes: [...toAttributes(trackAttributes, attributeNames), ...toAttributes(shape.attributes, attributeNames)],
      originalIndex: frame.boxes.length,
      globalIndex: globalIndex++,
    };
    frame.boxes.push(box);
  };

  const shapes = Array.isArray(annotations.shapes) ? annotations.shapes : [];
  const tracks = Array.isArray(annotations.tracks) ? annotations.tracks : [];

  shapes.forEach(shape => addShape(shape));
  tracks.forEach(track => {
    (Array.isArray(track.shapes) ? track.shapes : []).forEach(shape => addShape(shape, track.id, track.attributes));
  });

  if (Number.isInteger(frameRange?.start_frame) && Number.isInteger(frameRange?.stop_frame)) {
    const startFrame = frameRange!.start_frame!;
    const stopFrame = frameRange!.stop_frame!;
    for (let frameId = startFrame; frameId <= stopFrame; frameId++) getFrame(frameId);
  } else {
    for (let frameId = 0; frameId < (task.size ?? 0); frameId++) getFrame(frameId);
  }

  return {
    filename: `cvat-task-${task.id}.json`,
    taskName: task.name,
    labels: labels.map(label => label.name),
    labelColors: Object.fromEntries(labels.filter(label => label.color).map(label => [label.name, label.color!])),
    type: tracks.length > 0 ? 'tracks' : 'images',
    frames: [...frameMap.values()].sort((a, b) => Number(a.id) - Number(b.id)),
  };
}

export async function loadCvatTaskDataset(connection: CvatConnection, taskId: number): Promise<CVATDataset> {
  const [task, annotations, labels] = await Promise.all([
    cvatFetch<CvatTask>(connection, `/tasks/${taskId}`),
    cvatFetch<CvatAnnotations>(connection, `/tasks/${taskId}/annotations`),
    listCvatTaskLabels(connection, taskId),
  ]);
  return toCvatDataset({ ...task, labels: labels.length > 0 ? labels : task.labels }, annotations);
}

export async function loadCvatJobDataset(connection: CvatConnection, taskId: number, jobId: number): Promise<CVATDataset> {
  const [task, job, annotations, labels] = await Promise.all([
    cvatFetch<CvatTask>(connection, `/tasks/${taskId}`),
    cvatFetch<CvatJob>(connection, `/jobs/${jobId}`),
    cvatFetch<CvatAnnotations>(connection, `/jobs/${jobId}/annotations`),
    listCvatTaskLabels(connection, taskId),
  ]);
  return toCvatDataset({ ...task, name: `${task.name} — Job #${jobId}`, labels: labels.length > 0 ? labels : task.labels }, annotations, job);
}

function proxyUrl(path: string): string {
  if (path === '/tasks?page_size=1000') return '/api/cvat?resource=tasks';
  const jobsMatch = path.match(/^\/jobs\?task_id=(\d+)&page_size=1000$/);
  if (jobsMatch) return `/api/cvat?resource=jobs&taskId=${jobsMatch[1]}`;
  const labelsMatch = path.match(/^\/labels\?task_id=(\d+)&page_size=1000$/);
  if (labelsMatch) return `/api/cvat?resource=labels&taskId=${labelsMatch[1]}`;
  const jobMatch = path.match(/^\/jobs\/(\d+)(\/annotations)?$/);
  if (jobMatch) return `/api/cvat?resource=${jobMatch[2] ? 'jobAnnotations' : 'job'}&jobId=${jobMatch[1]}`;
  const match = path.match(/^\/tasks\/(\d+)(\/annotations)?$/);
  if (!match) throw new Error('Yêu cầu CVAT không được hỗ trợ.');
  const resource = match[2] ? 'annotations' : 'task';
  return `/api/cvat?resource=${resource}&taskId=${match[1]}`;
}

export async function loadCvatFrameImage(connection: CvatConnection, taskId: number, frameId: string, jobId?: number): Promise<Blob> {
  if (connection.mode === 'electron') {
    const response = await requestDesktop(connection, jobId ? { resource: 'jobFrame', jobId, frameId } : { resource: 'frame', taskId, frameId });
    if (response.status < 200 || response.status >= 300) throw new Error(`Không thể tải ảnh Frame ${frameId} từ CVAT (${response.status}).`);
    return new Blob([response.data as Uint8Array], { type: response.contentType });
  }

  const response = await fetch(
    connection.mode === 'vercel'
      ? `/api/cvat?resource=${jobId ? 'jobFrame' : 'frame'}&${jobId ? `jobId=${jobId}` : `taskId=${taskId}`}&frameId=${encodeURIComponent(frameId)}`
      : `${apiBaseUrl(connection.serverUrl)}/${jobId ? `jobs/${jobId}` : `tasks/${taskId}`}/data?type=frame&number=${encodeURIComponent(frameId)}&quality=compressed`,
    {
      headers: {
        Accept: '*/*',
        ...(connection.mode === 'direct' ? { Authorization: `Bearer ${connection.token.trim()}` } : {}),
      },
    },
  );

  if (!response.ok) throw new Error(`Không thể tải ảnh Frame ${frameId} từ CVAT (${response.status}).`);
  return response.blob();
}
