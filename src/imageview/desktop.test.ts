// @vitest-environment node
import { createRequire } from 'node:module';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { ImageViewCache } = require('../../desktop/imageview-cache.cjs');
const { createImageViewService } = require('../../desktop/imageview-service.cjs');
const directories: string[] = [];
async function directory() { const value = await mkdtemp(path.join(tmpdir(), 'cvat-viewer-test-')); directories.push(value); return value; }
afterEach(async () => { vi.useRealTimers(); await Promise.all(directories.splice(0).map(value => rm(value, { recursive: true, force: true }))); });

describe('ImageView disk cache', () => {
  it('persists and verifies images across restart without writing PATs', async () => {
    const dir = await directory(); const cache = new ImageViewCache(dir);
    await cache.write('server-account-revision-frame', { data: Buffer.from('image-data'), contentType: 'image/png' });
    const restored = new ImageViewCache(dir);
    expect((await restored.read('server-account-revision-frame')).data.toString()).toBe('image-data');
    expect((await restored.manage({ action: 'info' })).entries).toBe(1);
    const file = (await readdir(dir)).find(file => file.endsWith('.cache'))!;
    expect(file).toMatch(/^[a-f0-9]{64}\.cache$/);
    const bytes = await readFile(path.join(dir, file));
    bytes[bytes.length - 1] ^= 1;
    await writeFile(path.join(dir, file), bytes);
    expect(await restored.read('server-account-revision-frame')).toBeNull();
  });
  it('evicts the least recently used image within quota and supports clear/configure', async () => {
    const cache = new ImageViewCache(await directory());
    await cache.ready;
    cache.limitGB = 450 / 1024 ** 3;
    const value = { data: Buffer.alloc(80), contentType: 'image/png' };
    await cache.write('a', value); await cache.write('b', value); await cache.read('a'); await cache.write('c', value);
    expect(await cache.read('a')).not.toBeNull();
    expect(await cache.read('b')).toBeNull();
    expect((await cache.manage({ action: 'info' })).bytes).toBeLessThanOrEqual(450);
    expect((await cache.manage({ action: 'clear' })).entries).toBe(0);
    await expect(cache.manage({ action: 'configure', limitGB: 0 })).rejects.toThrow();
    expect((await cache.manage({ action: 'configure', limitGB: 1 })).limitGB).toBe(1);
  });
  it('retains valid cached images across days and prevents writes after a session closes', async () => {
    const cache = new ImageViewCache(await directory());
    await cache.write('closed', { data: Buffer.from('a'), contentType: 'image/png' }, () => false);
    expect(await cache.read('closed')).toBeNull();
    await cache.write('old', { data: Buffer.from('a'), contentType: 'image/png' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    expect((await cache.read('old')).data.toString()).toBe('a');
    vi.restoreAllMocks();
  });
  it('does not evict the current Job while downloading it and reports insufficient quota', async () => {
    const cache = new ImageViewCache(await directory());
    await cache.ready;
    cache.limitGB = 450 / 1024 ** 3;
    cache.protect('job', ['a', 'b', 'c']);
    const value = { data: Buffer.alloc(80), contentType: 'image/png' };
    await cache.write('a', value); await cache.write('b', value);
    await expect(cache.write('c', value)).rejects.toThrow('Cache đầy');
    expect(await cache.read('a')).not.toBeNull();
    expect(await cache.read('b')).not.toBeNull();
    cache.release('job');
    await cache.write('c', value);
    expect((await cache.manage({ action: 'info' })).bytes).toBeLessThanOrEqual(450);
  });
});

describe('ImageView CVAT sessions', () => {
  async function fixture() {
    let forbidden = false;
    const fetchImpl = vi.fn(async (url: string) => {
      if (forbidden) return new Response('{}', { status: 403 });
      return url.includes('/data?') ? new Response('image', { headers: { 'Content-Type': 'image/png' } })
        : Response.json({ task_id: 10, start_frame: 1, stop_frame: 5 });
    });
    const dir = await directory();
    const service = createImageViewService({ cacheDirectory: dir, tokenForServer: () => '', fetchImpl });
    const request = { serverUrl: 'http://cvat.test', token: 'test-only-pat', taskId: 10, jobId: 20, revision: 'r1', frames: [1, 2, 3] };
    const { sessionId } = await service.open(1, request);
    return { service, sessionId, fetchImpl, request, dir, forbid: () => { forbidden = true; } };
  }
  it('requests original frame IDs and serves authenticated cache hits', async () => {
    const { service, sessionId, fetchImpl } = await fixture();
    await service.frame(1, { sessionId, requestId: 'one', frameId: 3 });
    await service.frame(1, { sessionId, requestId: 'two', frameId: 3 });
    expect(fetchImpl.mock.calls.filter(([url]) => url.includes('/data?'))).toHaveLength(1);
    expect(fetchImpl.mock.calls[1][0]).toContain('number=3');
    await expect(service.frame(2, { sessionId, requestId: 'foreign', frameId: 3 })).rejects.toThrow('Phiên');
    await expect(service.frame(1, { sessionId, requestId: 'outside', frameId: 99 })).rejects.toThrow('Frame');
    service.close(1, sessionId);
  });
  it('isolates account/revision cache entries and rejects a mismatched Job', async () => {
    const { service, sessionId, request, fetchImpl } = await fixture();
    await service.frame(1, { sessionId, requestId: 'a', frameId: 1 });
    const other = await service.open(1, { ...request, token: 'different-pat' });
    await service.frame(1, { sessionId: other.sessionId, requestId: 'b', frameId: 1 });
    const changed = await service.open(1, { ...request, revision: 'r2' });
    await service.frame(1, { sessionId: changed.sessionId, requestId: 'c', frameId: 1 });
    expect(fetchImpl.mock.calls.filter(([url]) => url.includes('/data?'))).toHaveLength(3);
    await expect(service.open(1, { ...request, taskId: 999 })).rejects.toThrow('Task');
    service.closeOwner(1);
  });
  it('revalidates cached reads and clears cached data on permission loss', async () => {
    const { service, sessionId, forbid } = await fixture();
    await service.frame(1, { sessionId, requestId: 'a', frameId: 1 });
    forbid();
    const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    await expect(service.frame(1, { sessionId, requestId: 'b', frameId: 1 })).rejects.toThrow('403');
    expect((await service.manage({ action: 'info' })).entries).toBe(0);
    vi.restoreAllMocks();
  });
  it('downloads the whole Job automatically and reuses disk images after a service restart', async () => {
    const { service, sessionId, fetchImpl, request, dir } = await fixture();
    service.preload(1, sessionId);
    for (let i = 0; i < 100 && service.preloadStatus(1, sessionId).state === 'running'; i++) await new Promise(resolve => setTimeout(resolve, 5));
    expect(service.preloadStatus(1, sessionId)).toMatchObject({ state: 'complete', completed: 3, total: 3, failed: 0 });
    const downloads = () => fetchImpl.mock.calls.filter(([url]) => url.includes('/data?')).length;
    expect(downloads()).toBe(3);
    const sharedPreview = await service.frameForRequest(1, { ...request, resource: 'jobFrame', frameId: '2' });
    expect(sharedPreview.data.toString()).toBe('image');
    expect(downloads()).toBe(3);
    expect(service.frameForRequest(2, { ...request, resource: 'jobFrame', frameId: '2' })).toBeNull();
    service.closeOwner(1);
    const restored = createImageViewService({ cacheDirectory: dir, tokenForServer: () => '', fetchImpl });
    const next = await restored.open(1, request);
    for (const frameId of [1, 2, 3]) await restored.frame(1, { sessionId: next.sessionId, requestId: String(frameId), frameId, priority: true });
    expect(downloads()).toBe(3);
    restored.closeOwner(1);
  });
  it('cancels a background image fetch when the shared Job is closed', async () => {
    let downloadSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (url: string, options: RequestInit) => {
      if (!url.includes('/data?')) return Response.json({ task_id: 10, start_frame: 0, stop_frame: 2 });
      downloadSignal = options.signal!;
      return new Promise<Response>((_resolve, reject) => downloadSignal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
    });
    const service = createImageViewService({ cacheDirectory: await directory(), tokenForServer: () => '', fetchImpl });
    const { sessionId } = await service.open(1, { serverUrl: 'http://cvat.test', token: 'test', taskId: 10, jobId: 20, revision: 'r1', frames: [0, 1, 2] });
    service.preload(1, sessionId);
    for (let i = 0; i < 100 && !downloadSignal; i++) await new Promise(resolve => setTimeout(resolve, 5));
    expect(downloadSignal).toBeDefined();
    service.close(1, sessionId);
    expect(downloadSignal!.aborted).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect((await service.manage({ action: 'info' })).entries).toBe(0);
  });
});
