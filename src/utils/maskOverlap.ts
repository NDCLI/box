import type { CVATFrameData } from '../types';

export interface MaskShape {
  id: string;
  label: string;
  xtl: number;
  ytl: number;
  xbr: number;
  ybr: number;
  maskRle?: number[];
  outside?: boolean;
}

export interface MaskFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  boxes: MaskShape[];
}

export interface MaskOverlapPair {
  frameId: string;
  frameName: string;
  first: Pick<MaskShape, 'id' | 'label'>;
  second: Pick<MaskShape, 'id' | 'label'>;
  intersectionPixels: number;
  overlapOfSmaller: number;
  iou: number;
}

type Span = [number, number];
interface DecodedMask {
  box: MaskShape;
  rows: Map<number, Span[]>;
  area: number;
}

const ALLOWED_OVERLAP_LABEL_PAIRS = new Set(['head|person', 'licenseplate|vehicle']);

function isAllowedLabelOverlap(labelA: string, labelB: string): boolean {
  return ALLOWED_OVERLAP_LABEL_PAIRS.has([labelA.trim().toLowerCase(), labelB.trim().toLowerCase()].sort().join('|'));
}

function decodeMask(box: MaskShape, frame: Pick<CVATFrameData, 'width' | 'height'>): DecodedMask | null {
  if (!box.maskRle?.length) return null;
  const left = Math.round(box.xtl);
  const top = Math.round(box.ytl);
  const width = Math.round(box.xbr - box.xtl);
  const height = Math.round(box.ybr - box.ytl);
  const total = width * height;
  if (width <= 0 || height <= 0 || total > 20_000_000 || frame.width <= 0 || frame.height <= 0) return null;

  const rows = new Map<number, Span[]>();
  let area = 0;
  let offset = 0;
  let foreground = false;
  for (const rawRun of box.maskRle) {
    const run = Math.max(0, Math.floor(rawRun));
    const stop = Math.min(total, offset + run);
    if (foreground) {
      let cursor = offset;
      while (cursor < stop) {
        const localY = Math.floor(cursor / width);
        const rowStop = Math.min(stop, (localY + 1) * width);
        const y = top + localY;
        const x1 = Math.max(0, left + cursor % width);
        const x2 = Math.min(frame.width, left + (rowStop - localY * width));
        if (y >= 0 && y < frame.height && x2 > x1) {
          const spans = rows.get(y) ?? [];
          spans.push([x1, x2]);
          rows.set(y, spans);
          area += x2 - x1;
        }
        cursor = rowStop;
      }
    }
    offset = stop;
    foreground = !foreground;
    if (offset >= total) break;
  }
  return { box, rows, area };
}

export function getMaskSpans(box: MaskShape, frame: Pick<CVATFrameData, 'width' | 'height'>): { y: number; x1: number; x2: number }[] {
  const decoded = decodeMask(box, frame);
  if (!decoded) return [];
  return [...decoded.rows].flatMap(([y, spans]) => spans.map(([x1, x2]) => ({ y, x1, x2 })));
}

function intersectionSize(a: DecodedMask, b: DecodedMask): number {
  const [small, large] = a.rows.size <= b.rows.size ? [a, b] : [b, a];
  let total = 0;
  for (const [y, spansA] of small.rows) {
    const spansB = large.rows.get(y);
    if (!spansB) continue;
    let i = 0;
    let j = 0;
    while (i < spansA.length && j < spansB.length) {
      total += Math.max(0, Math.min(spansA[i][1], spansB[j][1]) - Math.max(spansA[i][0], spansB[j][0]));
      if (spansA[i][1] < spansB[j][1]) i++;
      else j++;
    }
  }
  return total;
}

export function findMaskOverlaps(
  frames: MaskFrame[],
  threshold: number,
  minIntersectionPixels: number,
  sameLabelOnly: boolean,
  onProgress?: (completed: number, total: number) => void,
): MaskOverlapPair[] {
  const pairs: MaskOverlapPair[] = [];
  let completed = 0;
  for (const frame of frames) {
    const masks = frame.boxes.filter(box => !box.outside)
      .map(box => decodeMask(box, frame))
      .filter((mask): mask is DecodedMask => mask !== null && mask.area > 0);
    for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) {
      const a = masks[i]; const b = masks[j];
      if (sameLabelOnly && a.box.label !== b.box.label) continue;
      if (isAllowedLabelOverlap(a.box.label, b.box.label)) continue;
      if (a.box.xbr <= b.box.xtl || b.box.xbr <= a.box.xtl || a.box.ybr <= b.box.ytl || b.box.ybr <= a.box.ytl) continue;
      const intersectionPixels = intersectionSize(a, b);
      const smallerArea = Math.min(a.area, b.area);
      if (intersectionPixels < minIntersectionPixels || intersectionPixels / smallerArea * 100 < threshold) continue;
      pairs.push({ frameId: frame.id, frameName: frame.name, first: { id: a.box.id, label: a.box.label },
        second: { id: b.box.id, label: b.box.label }, intersectionPixels,
        overlapOfSmaller: intersectionPixels / smallerArea * 100,
        iou: intersectionPixels / (a.area + b.area - intersectionPixels) * 100 });
    }
    onProgress?.(++completed, frames.length);
  }
  return pairs.sort((a, b) => b.overlapOfSmaller - a.overlapOfSmaller);
}
