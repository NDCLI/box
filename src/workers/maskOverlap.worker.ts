import { findMaskOverlaps, type MaskFrame } from '../utils/maskOverlap';

self.onmessage = (event: MessageEvent<{ frames: MaskFrame[]; threshold: number; minIntersectionPixels: number; sameLabelOnly: boolean }>) => {
  try {
    const { frames, threshold, minIntersectionPixels, sameLabelOnly } = event.data;
    const pairs = findMaskOverlaps(frames, threshold, minIntersectionPixels, sameLabelOnly, (completed, total) => {
      self.postMessage({ type: 'progress', completed, total });
    });
    self.postMessage({ type: 'done', pairs });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
