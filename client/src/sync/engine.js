// Moteur de synchronisation côté navigateur : file d'attente hors ligne,
// pull incrémental, cache de lecture, état pour l'interface.
import { syncDb, kvGet, kvSet } from './localdb.js';
import { getToken } from '../api.js';

const CLIENT_KEY = 'adiong-sync-client';
const OFFLINE_OK_DELAY = 800;
const PULL_INTERVAL = 30000;

const state = {
  started: false,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  lastSyncAt: 0,
  pending: 0,
  failed: 0
};
const listeners = new Set();
const emit = () => {
  for (const fn of listeners) {
    try { fn({ ...state }); } catch { /* écouteur défaillant */ }
  }
};
export const subscribe = (fn) => {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
};

const getClientId = () => {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = 'web-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
};

export const localIdGen = () => Math.floor(Date.now() * 1000) + Math.floor(Math.random() * 900);

const nowSec = () => Math.floor(Date.now() / 1000);

// ---------- Miroir local (lecture hors ligne + écritures optimistes) ----------
export const mirrorUpsert = async (table, row) => {
  const id = Number(row.id) || 0;
  if (!id) return;
  const existing = await syncDb.mirror.get([table, id]);
  const ts = Number(row.updated_at) || nowSec();
  if (existing && Number(existing.updatedAt) > ts && !existing.localPending) return;
  if (existing && existing.localPending && !row.localPending && Number(existing.updatedAt) > ts) return;
  await syncDb.mirror.put({ table, id, updatedAt: ts, localPending: row.localPending ? 1 : 0, data: row });
};

export const mirrorDelete = async (table, id) => {
  await syncDb.mirror.delete([table, id]);
};

export const mirrorRows = async (table) => {
  const rows = await syncDb.mirror.where('table').equals(table).toArray();
  rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return rows.map((r) => ({ ...r.data, __local: !!r.localPending, __id: r.id }));
};

export const cacheList = async (table, rows) => {
  if (!Array.isArray(rows)) return;
  const ts = nowSec();
  for (const r of rows) {
    const id = Number(r.id) || 0;
    if (!id) continue;
    const existing = await syncDb.mirror.get([table, id]);
    if (existing && Number(existing.updatedAt) >= ts && !existing.localPending) continue;
    await syncDb.mirror.put({ table, id, updatedAt: ts, localPending: 0, data: r });
  }
};

// ---------- File d'attente (outbox) ----------
const serializeBody = (body) => {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const entries = [];
    for (const [name, value] of body.entries()) {
      entries.push([name, value instanceof Blob ? { __blob: true, blob: value, name: value.name || '', type: value.type || '' } : value]);
    }
    return { __fd: entries };
  }
  return body == null ? null : body;
};

const rebuildBody = (stored) => {
  if (stored && Array.isArray(stored.__fd)) {
    const fd = new FormData();
    for (const [name, v] of stored.__fd) {
      if (v && v.__blob) fd.append(name, new Blob([v.blob], { type: v.type }), v.name || 'fichier');
      else fd.append(name, v);
    }
    return fd;
  }
  return stored;
};

export const queueWrite = async (method, path, body, meta = {}) => {
  const item = {
    method,
    path,
    body: serializeBody(body),
    createdAt: nowSec(),
    attempts: 0,
    nextTryAt: 0,
    status: 'pending',
    lastError: '',
    clientId: getClientId(),
    table: meta.table || '',
    localId: meta.localId || (meta.localRow ? Number(meta.localRow.id) || localIdGen() : 0)
  };
  item.id = await syncDb.outbox.add(item);
  if (meta.localRow) {
    const row = { ...meta.localRow, id: item.localId, updated_at: nowSec() };
    await mirrorUpsert(item.table, { ...row, localPending: true });
  }
  await refreshCounts();
  emit();
  scheduleSync(OFFLINE_OK_DELAY);
};

export const outboxList = async () => {
  const rows = await syncDb.outbox.orderBy('createdAt').toArray();
  return rows.map((r) => ({
    id: r.id,
    method: r.method,
    path: r.path,
    createdAt: r.createdAt,
    status: r.status,
    attempts: r.attempts,
    lastError: r.lastError || ''
  }));
};

export const retryOutbox = async (id) => {
  await syncDb.outbox.update(id, { status: 'pending', nextTryAt: 0, lastError: '' });
  await refreshCounts();
  emit();
  scheduleSync(300);
};

export const discardOutbox = async (id) => {
  const item = await syncDb.outbox.get(id);
  if (item && item.table && item.localId) await mirrorDelete(item.table, item.localId);
  await syncDb.outbox.delete(id);
  await refreshCounts();
  emit();
};

const refreshCounts = async () => {
  const [pending, failed] = await Promise.all([
    syncDb.outbox.where('status').equals('pending').count(),
    syncDb.outbox.where('status').equals('failed').count()
  ]);
  state.pending = pending;
  state.failed = failed;
};

// ---------- Tirage de la file ----------
const backoffMs = (attempts) => Math.min(30000 * Math.pow(2, attempts), 15 * 60000);

const doFetch = async (item) => {
  const headers = {};
  const body = rebuildBody(item.body);
  const isForm = body instanceof FormData;
  if (body != null && !isForm) headers['Content-Type'] = 'application/json';
  const t = getToken();
  if (t && (/^\/api\/admin/.test(item.path) || /^\/api\/me/.test(item.path))) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(item.path, {
    method: item.method,
    headers,
    body: body == null ? undefined : isForm ? body : JSON.stringify(body)
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw: raw.slice(0, 200) }; }
  return { res, data };
};

export const drainOutbox = async () => {
  if (state.syncing) return;
  state.syncing = true;
  emit();
  try {
    let guard = 0;
    while (guard++ < 50) {
      const items = await syncDb.outbox
        .where('status').equals('pending')
        .and((r) => !r.nextTryAt || r.nextTryAt <= nowSec())
        .sortBy('createdAt');
      if (!items.length) break;
      const item = items[0];
      try {
        const { res, data } = await doFetch(item);
        if (res.ok) {
          await syncDb.outbox.delete(item.id);
          if (item.table && item.localId) await mirrorDelete(item.table, item.localId);
        } else {
          const msg = (data && data.error) || `Erreur ${res.status}`;
          await syncDb.outbox.update(item.id, { status: 'failed', lastError: msg });
        }
      } catch {
        const attempts = (item.attempts || 0) + 1;
        await syncDb.outbox.update(item.id, { attempts, nextTryAt: nowSec() + Math.ceil(backoffMs(attempts) / 1000) });
        await refreshCounts();
        emit();
        break;
      }
      await refreshCounts();
      emit();
    }
  } finally {
    state.syncing = false;
    emit();
  }
};

// ---------- Pull incrémental ----------
export const pull = async () => {
  const t = getToken();
  if (!t) return;
  try {
    const since = (await kvGet('lastPullAt', 0)) || 0;
    const res = await fetch(`/api/sync/pull?since=${since}`, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return;
    const payload = await res.json();
    let count = 0;
    for (const [table, rows] of Object.entries(payload.tables || {})) {
      for (const r of rows) {
        const id = Number(r.id) || 0;
        if (!id) continue;
        const existing = await syncDb.mirror.get([table, id]);
        const ts = Number(r.updated_at) || 0;
        if (existing && Number(existing.updatedAt) > ts) continue;
        // écriture locale non envoyée : elle prime jusqu'à ce que la push
        // ait eu lieu (le conflit sera alors réglé côté serveur par LWW)
        if (existing && existing.localPending) continue;
        await syncDb.mirror.put({ table, id, updatedAt: ts, localPending: 0, data: r });
        count++;
      }
    }
    for (const tm of payload.tombstones || []) {
      await syncDb.mirror.delete([tm.table, Number(tm.id) || 0]);
    }
    if (payload.serverTime) {
      await kvSet('lastPullAt', payload.serverTime);
      state.lastSyncAt = nowSec();
      await kvSet('lastSyncAt', state.lastSyncAt);
    }
    return count;
  } catch {
    return 0;
  }
};

export const syncNow = async () => {
  await drainOutbox();
  if (getToken() && state.online) await pull();
};

// ---------- Cycle de vie ----------
let timer = null;
let debounce = null;
const scheduleSync = (delay = 0) => {
  if (!state.online) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => { void syncNow(); }, delay);
};

const onOnline = () => { state.online = true; emit(); scheduleSync(1000); };
const onOffline = () => { state.online = false; emit(); };

export const start = async () => {
  if (state.started) return;
  state.started = true;
  state.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  state.lastSyncAt = (await kvGet('lastSyncAt', 0)) || 0;
  await refreshCounts();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  timer = setInterval(() => { if (state.online) void syncNow(); }, PULL_INTERVAL);
  emit();
  if (state.online) void syncNow();
};

export const stop = () => {
  state.started = false;
  clearInterval(timer);
  clearTimeout(debounce);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
};
