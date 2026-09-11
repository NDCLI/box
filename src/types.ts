export interface CVATAttribute {
  name: string;
  value: string;
}

export interface CVATBox {
  id: string; // generated client-side id for UI reference
  label: string;
  labelId?: number;
  serverShapeId?: number;
  annotationKind?: 'shape' | 'track';
  serverPayload?: CvatShapePayload;
  xtl: number;
  ytl: number;
  xbr: number;
  ybr: number;
  occluded: boolean;
  z_order?: number;
  group_id?: number;
  source?: string;
  outside?: boolean;
  keyframe?: boolean;
  attributes: CVATAttribute[];
  // Track specific
  trackId?: string;
  // XML DOM Node reference or path to help recreate/clean
  originalIndex: number; 
  globalIndex: number;
}

export interface CvatShapeAttribute {
  spec_id: number;
  value: string;
}

export interface CvatShapePayload {
  id: number;
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
  attributes?: CvatShapeAttribute[];
}

export interface CVATFrameData {
  id: string; // frame index or image id
  name: string; // image name or frame number
  width: number;
  height: number;
  boxes: CVATBox[];
}

export interface CVATDataset {
  filename: string;
  taskName?: string;
  labels: string[];
  labelColors?: Record<string, string>;
  type: 'images' | 'tracks';
  frames: CVATFrameData[];
  source?: 'zip' | 'xml' | 'cvat';
  cvatContext?: {
    serverUrl: string;
    taskId: number;
    jobId?: number;
  };
}

export interface DuplicateGroup {
  id: string;
  frameId: string;
  frameName: string;
  boxes: CVATBox[];
  overlapPercentage: number; // 100 for exact, or IoU * 100
}

export type DuplicateSelection = 'keep' | 'delete' | 'undecided';

export interface DetectionSettings {
  matchLabelOnly: boolean;
  tolerancePx: number; // 0 for exact match, or tolerance in pixels
  overlapThreshold: number; // IoU threshold (0 - 100%)
  useIoU: boolean; // if true, use IoU; if false, use Coordinate Tolerance
}
