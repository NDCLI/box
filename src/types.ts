export interface CVATAttribute {
  name: string;
  value: string;
}

export interface CVATBox {
  id: string; // generated client-side id for UI reference
  label: string;
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
  type: 'images' | 'tracks';
  frames: CVATFrameData[];
}

export interface DuplicateGroup {
  id: string;
  frameId: string;
  frameName: string;
  boxes: CVATBox[];
  overlapPercentage: number; // 100 for exact, or IoU * 100
}

export interface DetectionSettings {
  matchLabelOnly: boolean;
  tolerancePx: number; // 0 for exact match, or tolerance in pixels
  overlapThreshold: number; // IoU threshold (0 - 100%)
  useIoU: boolean; // if true, use IoU; if false, use Coordinate Tolerance
}
