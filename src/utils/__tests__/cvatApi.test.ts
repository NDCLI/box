import { describe, expect, it } from 'vitest';
import { toCvatDataset } from '../cvatApi';

describe('toCvatDataset', () => {
  it('converts CVAT rectangles into frame boxes and retains labels', () => {
    const dataset = toCvatDataset(
      {
        id: 12,
        name: 'Remote task',
        size: 2,
        labels: [{ id: 7, name: 'car', color: '#ff0000' }],
      },
      {
        shapes: [
          { id: 99, label_id: 7, frame: 1, type: 'rectangle', points: [10, 20, 110, 220] },
          { id: 100, label_id: 7, frame: 1, type: 'polygon', points: [0, 0, 1, 1] },
        ],
      },
    );

    expect(dataset.filename).toBe('cvat-task-12.json');
    expect(dataset.taskName).toBe('Remote task');
    expect(dataset.frames).toHaveLength(2);
    expect(dataset.frames[1].boxes).toMatchObject([{ id: '99', label: 'car', xtl: 10, ytl: 20, xbr: 110, ybr: 220 }]);
    expect(dataset.labelColors).toEqual({ car: '#ff0000' });
  });

  it('uses visible rectangle track shapes and ignores outside boxes', () => {
    const dataset = toCvatDataset(
      { id: 2, name: 'Video task', labels: [{ id: 1, name: 'person' }] },
      {
        tracks: [{
          id: 5,
          label_id: 1,
          shapes: [
            { label_id: 1, frame: 3, type: 'rectangle', points: [1, 2, 3, 4], outside: false },
            { label_id: 1, frame: 4, type: 'rectangle', points: [1, 2, 3, 4], outside: true },
          ],
        }],
      },
    );

    expect(dataset.type).toBe('tracks');
    expect(dataset.frames).toHaveLength(1);
    expect(dataset.frames[0].boxes[0].trackId).toBe('5');
  });

  it('uses label names when CVAT returns labels as an object', () => {
    const dataset = toCvatDataset(
      { id: 3, name: 'Object labels', labels: { 8: { id: 8, name: 'helmet' } } } as never,
      { shapes: [{ label_id: 8, frame: 0, type: 'rectangle', points: [0, 0, 50, 60] }] },
    );

    expect(dataset.labels).toEqual(['helmet']);
    expect(dataset.frames[0]).toMatchObject({ width: 50, height: 60 });
    expect(dataset.frames[0].boxes[0].label).toBe('helmet');
  });
});
