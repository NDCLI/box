import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCvatSource, cvatSessionRequest } from './sources';
import { loadCvatViewerPayload } from '../utils/cvatApi';
import type { ViewerPayload } from './metadata';
vi.mock('../utils/cvatApi', () => ({ loadCvatViewerPayload: vi.fn() }));
afterEach(() => { delete window.cvatDesktop; localStorage.clear(); vi.clearAllMocks(); });

describe('shared ImageView source', () => {
  it('keeps the image cache identity when only annotations change', () => {
    const payload: ViewerPayload = { task: { id: 10, name: 'Shared', updated_date: 'old', size: 1 },
      job: { id: 20, start_frame: 0, stop_frame: 0, updated_date: 'old' },
      meta: { frames: [{ name: 'a.jpg', width: 20, height: 20 }] }, labels: [], annotations: {} };
    const connection = { mode: 'electron' as const, serverUrl: 'http://cvat.test', token: 'test' };
    const original = cvatSessionRequest(connection, 10, 20, payload).revision;
    payload.task.updated_date = 'new'; payload.job!.updated_date = 'new';
    expect(cvatSessionRequest(connection, 10, 20, payload).revision).toBe(original);
    payload.meta.chunks_updated_date = 'images-updated';
    expect(cvatSessionRequest(connection, 10, 20, payload).revision).not.toBe(original);
  });
  it('uses Home metadata and annotations without fetching another snapshot per tab', async () => {
    const open = vi.fn().mockResolvedValue({ sessionId: 'test-session' });
    const close = vi.fn().mockResolvedValue(undefined);
    window.cvatDesktop = { viewerOpen: open, viewerClose: close, viewerFrame: vi.fn(),
      request: vi.fn(), getStoredToken: vi.fn(), saveToken: vi.fn(), hasDefaultToken: vi.fn() };
    const payload: ViewerPayload = { task: { id: 10, name: 'Shared', size: 2 },
      meta: { frames: [{ name: 'b.jpg', width: 20, height: 20 }, { name: 'a.jpg', width: 20, height: 20 }] },
      labels: [{ id: 3, name: 'car' }], annotations: { shapes: [{ frame: 1, type: 'rectangle', label_id: 3, points: [1, 2, 10, 12] }] } };
    const source = await createCvatSource({ mode: 'electron', serverUrl: 'http://cvat.test', token: 'test' }, 10, undefined, payload);
    expect(loadCvatViewerPayload).not.toHaveBeenCalled();
    expect(source.images.map(image => image.frameId)).toEqual([1, 0]);
    expect(source.annotations.images['1'].boxes[0].label).toBe('car');
    source.dispose();
    expect(close).toHaveBeenCalledWith('test-session');
  });
});
