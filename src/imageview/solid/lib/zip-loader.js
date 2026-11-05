export async function openZip(file) {
  const worker = new Worker(new URL('../workers/zip.worker.js', import.meta.url), {
    type: 'module',
  })
  let nextRequestId = 0
  const pending = new Map()

  worker.onmessage = ({ data }) => {
    const request = pending.get(data.requestId)
    if (!request) return
    pending.delete(data.requestId)
    if (data.type === 'error') {
      request.reject(new Error(data.message))
    } else {
      request.resolve(data)
    }
  }

  worker.onerror = (event) => {
    pending.forEach(({ reject }) => reject(event.error ?? new Error(event.message)))
    pending.clear()
  }

  const request = (message) =>
    new Promise((resolve, reject) => {
      const requestId = String(++nextRequestId)
      pending.set(requestId, { resolve, reject })
      worker.postMessage({ ...message, requestId })
    })

  let loaded
  try { loaded = await request({ type: 'load', file, cacheKey: null }) }
  catch (error) { worker.terminate(); throw error }
  const pathSet = new Set(loaded.paths)
  return {
    paths: loaded.paths,
    hasPath: (name) => pathSet.has(name),
    annotationsText: loaded.annotationsText,
    getBlob: async (name, options = {}) => (await request({ type: 'blob', name, ...options })).blob,
    warmBlobs: async (names, options = {}, onProgress) => {
      let completed = 0
      await Promise.all(
        names.map(async (name) => {
          await request({ type: 'warm', name, ...options })
          completed += 1
          onProgress?.(completed, names.length)
        }),
      )
    },
    terminate: () => {
      worker.terminate()
      pending.forEach(({ reject }) => reject(new DOMException('Session closed', 'AbortError')))
      pending.clear()
    },
  }
}
