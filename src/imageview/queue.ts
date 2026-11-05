interface Entry<T = unknown> {
  priority: boolean;
  signal: AbortSignal;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  abort: () => void;
}

export function createImageQueue(concurrency = 3) {
  const waiting: Entry<any>[] = [];
  let running = 0;
  const pump = () => {
    while (running < concurrency && waiting.length) {
      const entry = waiting.shift()!;
      entry.signal.removeEventListener('abort', entry.abort);
      if (entry.signal.aborted) { entry.reject(new DOMException('Cancelled', 'AbortError')); continue; }
      running++;
      void entry.run().then(entry.resolve, entry.reject).finally(() => { running--; pump(); });
    }
  };
  return {
    run<T>(run: () => Promise<T>, priority: boolean, signal: AbortSignal): Promise<T> {
      if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
      return new Promise((resolve, reject) => {
        const entry: Entry<T> = { run, priority, signal, resolve, reject, abort: () => {
          const index = waiting.indexOf(entry);
          if (index >= 0) waiting.splice(index, 1);
          reject(new DOMException('Cancelled', 'AbortError'));
        } };
        signal.addEventListener('abort', entry.abort, { once: true });
        const index = priority ? waiting.findIndex(item => !item.priority) : -1;
        if (index < 0) waiting.push(entry); else waiting.splice(index, 0, entry);
        pump();
      });
    },
  };
}
