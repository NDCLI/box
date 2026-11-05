import { describe, expect, it } from 'vitest';
import { mapViewerPayload, sortByImageName, type ViewerPayload } from './metadata';

const fixture = (): ViewerPayload => ({
  task: { id: 10, name: 'Test', size: 4 },
  meta: { start_frame: 100, stop_frame: 106, frame_filter: 'step=2', frames: [
    { name: 'b.jpg', width: 100, height: 80 }, { name: '10.jpg', width: 100, height: 80 },
    { name: '2.jpg', width: 100, height: 80 }, { name: 'a.jpg', width: 100, height: 80 },
  ] },
  labels: [{ id: 3, name: 'car', color: '#00ff00' }],
  annotations: { shapes: [{ frame: 3, type: 'rectangle', label_id: 3, points: [1, 2, 20, 30] }] },
});

describe('ImageView filename order and CVAT frame identity', () => {
  it('matches ZIP localeCompare ordering including non-padded numbers, paths and Unicode', () => {
    const names = ['2.jpg', '10.jpg', '1.jpg', '001.jpg', 'á.jpg', 'A.jpg', 'a.jpg', 'camera1/a.jpg', 'camera2/a.jpg'];
    expect(sortByImageName(names.map(name => ({ name }))).map(image => image.name)).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it('does not mutate the input and keeps duplicate names stable', () => {
    const images = [{ name: 'b', id: 0 }, { name: 'a', id: 1 }, { name: 'a', id: 2 }];
    expect(sortByImageName(images).map(image => image.id)).toEqual([1, 2, 0]);
    expect(images[0].id).toBe(0);
  });
  it('sorts names while retaining normalized CVAT IDs for image requests and overlays', () => {
    const result = mapViewerPayload(fixture());
    expect(result.images.map(image => [image.name, image.frameId])).toEqual([['10.jpg', 1], ['2.jpg', 2], ['a.jpg', 3], ['b.jpg', 0]]);
    expect(result.annotations.images['3'].boxes[0]).toMatchObject({ label: 'car', xtl: 1, ytl: 2 });
  });
  it('handles nonzero Job boundaries, source step, included and deleted frames', () => {
    const payload = fixture();
    payload.job = { id: 20, start_frame: 1, stop_frame: 3 };
    payload.jobMeta = { frames: [], included_frames: [102, 106], deleted_frames: [1] };
    expect(mapViewerPayload(payload).images.map(image => image.frameId)).toEqual([3]);
  });
  it('keeps same basenames and even identical full names independently keyed', () => {
    const payload = fixture();
    payload.meta.frames.forEach((image, index) => { image.name = index < 2 ? 'camera/a.jpg' : 'camera2/a.jpg'; });
    const result = mapViewerPayload(payload);
    expect(new Set(result.images.map(image => image.key)).size).toBe(4);
    expect(result.annotations.images['3'].boxes).toHaveLength(1);
  });
  it('expands video metadata without inventing interpolated Track boxes', () => {
    const payload = fixture();
    payload.task.mode = 'interpolation'; payload.meta.frames = [payload.meta.frames[0]];
    payload.annotations.tracks = [{}];
    const result = mapViewerPayload(payload);
    expect(result.images).toHaveLength(4);
    expect(result.warning).toContain('Track');
    expect(result.annotations.images['1'].boxes).toEqual([]);
  });
  it('reports missing names and ignores non-rectangle and outside annotations', () => {
    const payload = fixture(); delete payload.meta.frames[0].name;
    payload.annotations.shapes!.push({ frame: 3, type: 'mask', label_id: 3, points: [0, 1, 2, 3, 4] }, { frame: 3, type: 'rectangle', outside: true, label_id: 3, points: [1, 2, 3, 4] });
    const result = mapViewerPayload(payload);
    expect(result.warning).toContain('tên');
    expect(result.annotations.images['3'].boxes).toHaveLength(1);
  });
});
