import { describe, expect, it } from 'vitest';
import { createImageQueue } from './queue';

describe('ImageView queue', () => {
  it('bounds concurrency, prioritizes the visible frame and removes cancelled prefetches', async () => {
    const queue = createImageQueue(1);
    const controller = new AbortController();
    let finish!: () => void;
    const order: number[] = [];
    const first = queue.run(() => new Promise<void>(resolve => { finish = resolve; }), false, new AbortController().signal);
    const prefetch = queue.run(async () => { order.push(1); }, false, new AbortController().signal);
    const cancelled = queue.run(async () => { order.push(2); }, false, controller.signal).catch(error => error.name);
    const visible = queue.run(async () => { order.push(3); }, true, new AbortController().signal);
    controller.abort(); finish();
    await Promise.all([first, prefetch, visible]);
    expect(await cancelled).toBe('AbortError');
    expect(order).toEqual([3, 1]);
  });
  it('continues after a failed image and rejects already aborted requests', async () => {
    const queue = createImageQueue(1);
    await expect(queue.run(async () => { throw new Error('broken image'); }, true, new AbortController().signal)).rejects.toThrow('broken image');
    expect(await queue.run(async () => 42, true, new AbortController().signal)).toBe(42);
    const controller = new AbortController(); controller.abort();
    await expect(queue.run(async () => 0, true, controller.signal)).rejects.toHaveProperty('name', 'AbortError');
  });
});
