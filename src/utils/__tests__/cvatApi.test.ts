import { describe, expect, it, vi } from 'vitest';
import { deleteCvatJobShapes, toCvatDataset } from '../cvatApi';
import type { CVATBox } from '../../types';

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

describe('deleteCvatJobShapes', () => {
  const shape = {
    id: 99,
    label_id: 7,
    frame: 1,
    type: 'rectangle',
    points: [10, 20, 110, 220],
    occluded: false,
    z_order: 0,
    attributes: [],
  };
  const box = (id: number): CVATBox => ({
    id: String(id),
    label: 'car',
    labelId: 7,
    serverShapeId: id,
    annotationKind: 'shape',
    serverPayload: { ...shape, id },
    xtl: 10,
    ytl: 20,
    xbr: 110,
    ybr: 220,
    occluded: false,
    attributes: [],
    originalIndex: 0,
    globalIndex: 1,
  });

  it('backs up, patches only selected shapes, and verifies deletion', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ status: 200, data: { shapes: [shape] } })
      .mockResolvedValueOnce({ status: 204, data: null })
      .mockResolvedValueOnce({ status: 200, data: { shapes: [] } });
    const saveBackup = vi.fn().mockResolvedValue({ path: 'C:/backup.json' });
    window.cvatDesktop = { request, saveBackup, getStoredToken: vi.fn(), saveToken: vi.fn(), hasDefaultToken: vi.fn() };

    const result = await deleteCvatJobShapes(
      { mode: 'electron', serverUrl: 'http://cvat', token: 'secret' },
      12,
      101,
      [box(99)],
      [],
    );

    expect(saveBackup).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[1][0]).toMatchObject({ method: 'PATCH', resource: 'jobAnnotationsDelete', jobId: 101 });
    expect(request.mock.calls[1][0].body).toEqual({
      shapes: [{ ...shape, id: 99 }],
      tracks: [],
      tags: [],
    });
    expect(result.deletedShapeIds).toEqual([99]);
  });

  it('stops before backup and PATCH when the server shape changed', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { shapes: [{ ...shape, points: [11, 20, 110, 220] }] } });
    const saveBackup = vi.fn();
    window.cvatDesktop = { request, saveBackup, getStoredToken: vi.fn(), saveToken: vi.fn(), hasDefaultToken: vi.fn() };

    await expect(deleteCvatJobShapes(
      { mode: 'electron', serverUrl: 'http://cvat', token: 'secret' },
      12,
      101,
      [box(99)],
      [],
    )).rejects.toThrow('đã thay đổi');
    expect(saveBackup).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
