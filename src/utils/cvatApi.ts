import type { CVATAttribute, CVATBox, CVATDataset, CVATFrameData } from '../types';

export interface CvatConnection {
  serverUrl: string;
  token: string;
}

export interface CvatTaskSummary {
  id: number;
  name: string;
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
  labels?: CvatLabel[];
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

function apiBaseUrl(serverUrl: string): string {
  const normalized = serverUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('URL CVAT phải bắt đầu bằng http:// hoặc https://.');
  }
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

async function cvatFetch<T>(connection: CvatConnection, path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl(connection.serverUrl)}${path}`, {
    headers: {
      Authorization: `Token ${connection.token.trim()}`,
      Accept: 'application/vnd.cvat+json, application/json',
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

export async function listCvatTasks(connection: CvatConnection): Promise<CvatTaskSummary[]> {
  const data = await cvatFetch<CvatTaskSummary[] | { results?: CvatTaskSummary[] }>(connection, '/tasks?limit=100');
  return Array.isArray(data) ? data : data.results ?? [];
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

export function toCvatDataset(task: CvatTask, annotations: CvatAnnotations): CVATDataset {
  const labels = task.labels ?? [];
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
      originalIndex: getFrame(shape.frame).boxes.length,
      globalIndex: globalIndex++,
    };
    getFrame(shape.frame).boxes.push(box);
  };

  (annotations.shapes ?? []).forEach(shape => addShape(shape));
  (annotations.tracks ?? []).forEach(track => {
    track.shapes?.forEach(shape => addShape(shape, track.id, track.attributes));
  });

  for (let frameId = 0; frameId < (task.size ?? 0); frameId++) getFrame(frameId);

  return {
    filename: `cvat-task-${task.id}.json`,
    taskName: task.name,
    labels: labels.map(label => label.name),
    labelColors: Object.fromEntries(labels.filter(label => label.color).map(label => [label.name, label.color!])),
    type: (annotations.tracks?.length ?? 0) > 0 ? 'tracks' : 'images',
    frames: [...frameMap.values()].sort((a, b) => Number(a.id) - Number(b.id)),
  };
}

export async function loadCvatTaskDataset(connection: CvatConnection, taskId: number): Promise<CVATDataset> {
  const [task, annotations] = await Promise.all([
    cvatFetch<CvatTask>(connection, `/tasks/${taskId}`),
    cvatFetch<CvatAnnotations>(connection, `/tasks/${taskId}/annotations`),
  ]);
  return toCvatDataset(task, annotations);
}

export async function loadCvatFrameImage(connection: CvatConnection, taskId: number, frameId: string): Promise<Blob> {
  const response = await fetch(
    `${apiBaseUrl(connection.serverUrl)}/tasks/${taskId}/data?type=frame&number=${encodeURIComponent(frameId)}&quality=compressed`,
    {
      headers: {
        Authorization: `Token ${connection.token.trim()}`,
        Accept: 'image/*',
      },
    },
  );

  if (!response.ok) throw new Error(`Không thể tải ảnh Frame ${frameId} từ CVAT (${response.status}).`);
  return response.blob();
}
