function readQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readTaskId(value) {
  const taskId = Number(readQueryValue(value));
  return Number.isInteger(taskId) && taskId > 0 ? taskId : null;
}

function cvatApiBaseUrl() {
  const configuredUrl = process.env.CVAT_BASE_URL;
  if (!configuredUrl) return null;
  const normalized = configuredUrl.trim().replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiBaseUrl = cvatApiBaseUrl();
  const token = process.env.CVAT_PAT;
  if (!apiBaseUrl || !token) {
    return res.status(503).json({ error: 'CVAT proxy chưa được cấu hình.' });
  }

  const resource = readQueryValue(req.query.resource);
  const taskId = readTaskId(req.query.taskId);
  let upstreamPath;
  let accept = 'application/vnd.cvat+json, application/json';

  if (resource === 'tasks') {
    upstreamPath = '/tasks?limit=100';
  } else if (resource === 'task' && taskId) {
    upstreamPath = `/tasks/${taskId}`;
  } else if (resource === 'annotations' && taskId) {
    upstreamPath = `/tasks/${taskId}/annotations`;
  } else if (resource === 'frame' && taskId) {
    const frameId = readQueryValue(req.query.frameId);
    if (!/^\d+$/.test(frameId ?? '')) return res.status(400).json({ error: 'Frame ID không hợp lệ.' });
    upstreamPath = `/tasks/${taskId}/data?type=frame&number=${encodeURIComponent(frameId)}&quality=compressed`;
    accept = 'image/*';
  } else {
    return res.status(400).json({ error: 'Yêu cầu CVAT không hợp lệ.' });
  }

  try {
    const upstream = await fetch(`${apiBaseUrl}${upstreamPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
      },
    });

    if (resource === 'frame') {
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      return res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.status).send(await upstream.text());
  } catch {
    return res.status(502).json({ error: 'Không thể kết nối tới CVAT server.' });
  }
}
