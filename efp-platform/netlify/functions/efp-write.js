// EFP Firebase Write Proxy
// Receives GET requests from the scheduled sync (which can't do PUT/POST directly)
// and writes to Firebase Realtime Database on its behalf.

const FIREBASE_BASE = 'https://efp-platform-f2aaa-default-rtdb.europe-west1.firebasedatabase.app';
const SECRET = 'efp-sync-2026-xK9m';

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};

  // Security check
  if (p.secret !== SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { path, method, data } = p;
  if (!path || !data) {
    return { statusCode: 400, body: 'Missing path or data' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(decodeURIComponent(data), 'base64').toString('utf8'));
    const url = `${FIREBASE_BASE}/${path}.json`;

    let payload;

    if (method === 'prepend') {
      // Read current array, prepend new entries (deduped by id)
      const cur = await fetch(url).then(r => r.json()).catch(() => null);
      const base = Array.isArray(cur) ? cur : (cur && typeof cur === 'object' ? Object.values(cur) : []);
      const existingIds = new Set(base.map(l => String(l.id)));
      const newEntries = (Array.isArray(decoded) ? decoded : [decoded]).filter(l => !existingIds.has(String(l.id)));
      const merged = [...newEntries, ...base];
      // Only sort numerically if all IDs are plain numbers (logsAdded) — needs/mandates use string IDs
      const allNumeric = merged.every(l => typeof l.id === 'number' || /^\d+$/.test(String(l.id || '')));
      if (allNumeric && merged.length > 0) merged.sort((a, b) => Number(b.id) - Number(a.id));
      payload = merged;
    } else if (method === 'patch') {
      // PATCH — merge fields into existing object
      const cur = await fetch(url).then(r => r.json()).catch(() => ({}));
      payload = { ...(cur || {}), ...decoded };
    } else if (method === 'update-pitch') {
      // Update specific pitch(es) by id
      const updates = Array.isArray(decoded) ? decoded : [decoded]; // [{id, fields}]
      const cur = await fetch(url).then(r => r.json()).catch(() => []);
      const pitches = Array.isArray(cur) ? cur : Object.values(cur || {});
      payload = pitches.map(p => {
        const upd = updates.find(u => u.id === p.id);
        return upd ? { ...p, ...upd.fields } : p;
      });
    } else {
      // Default: PUT (full replace)
      payload = decoded;
    }

    const resp = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      return { statusCode: 500, body: `Firebase error: ${resp.status} ${await resp.text()}` };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, method, path, count: Array.isArray(payload) ? payload.length : 1 })
    };

  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};
