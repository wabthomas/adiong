// ---------- Synchronisation automatique de la copie locale (Phase 2) ----------
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting } from './db.js';
import { SYNC_TABLES, nowSec, syncStateGet, syncStateSet, logSync, applyRow, applyDelete, bumpIdSpaces } from './sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.ADI_UPLOADS_DIR || path.join(__dirname, 'uploads');

const state = {
  url: getSetting('sync_url') || '',
  token: getSetting('sync_token') || '',
  intervalMs: parseInt(getSetting('sync_interval') || '300000', 10),
  running: false,
  lastRunAt: 0,
  lastError: '',
  lastStats: {}
};

const http = async (method, apiPath, { body, raw } = {}) => {
  const headers = { Authorization: `Bearer ${state.token}` };
  let payload;
  if (raw) {
    payload = raw;
    headers['Content-Type'] = 'application/octet-stream';
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch(state.url.replace(/\/+$/, '') + apiPath, { method, headers, body: payload });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  if (!r.ok) throw new Error(`${method} ${apiPath} → ${r.status} ${data.error || ''}`);
  return data;
};

const fileSha = (full) => {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(full));
  return h.digest('hex');
};

const mediaPath = (url) => {
  const rel = String(url || '').replace(/^\/+/, '').replace(/^uploads\//, '');
  if (!rel || rel.includes('..') || rel.includes('\\')) return null;
  const full = path.resolve(uploadDir, rel);
  if (full !== uploadDir && !full.startsWith(uploadDir + path.sep)) return null;
  return { rel, full };
};

export const syncWorkerStatus = () => ({
  available: process.env.LOCAL_COPY === '1',
  configured: Boolean(state.url && state.token),
  url: state.url,
  intervalMs: state.intervalMs,
  running: state.running,
  lastRunAt: state.lastRunAt,
  lastError: state.lastError,
  lastStats: state.lastStats
});

export function syncWorkerConfig({ url, token, intervalMs }) {
  if (process.env.LOCAL_COPY !== '1') return { ok: false, error: 'Réservé à la copie locale' };
  if (url) {
    try { new URL(url); } catch { return { ok: false, error: 'URL invalide' }; }
    state.url = url.replace(/\/+$/, '');
    setSetting('sync_url', state.url);
  }
  if (token) { state.token = String(token); setSetting('sync_token', state.token); }
  const iv = parseInt(intervalMs, 10);
  if (Number.isFinite(iv) && iv >= 30000 && iv <= 3600000) { state.intervalMs = iv; setSetting('sync_interval', String(iv)); }
  return { ok: true, ...syncWorkerStatus() };
}

// Un cycle complet : push (lignes + médias) puis pull (lignes + médias).
export async function syncWorkerRun() {
  if (state.running) return { ok: false, error: 'Synchronisation déjà en cours' };
  if (!state.url || !state.token) return { ok: false, error: 'Non configurée (URL et jeton requis)' };
  state.running = true;
  state.lastError = '';
  const stats = { pushed: 0, conflicts: 0, rejected: 0, pulled: 0, mediaUp: 0, mediaDn: 0 };
  try {
    bumpIdSpaces();
    const gs = syncStateGet('_global');

    // ---- PUSH : lignes locales ----
    const rows = [];
    for (const [t, c] of Object.entries(SYNC_TABLES)) {
      if (!c.push) continue;
      for (const r of db.prepare(`SELECT * FROM ${t} WHERE origin = 'local' AND updated_at > ? ORDER BY updated_at ASC`).all(gs.last_pushed_at)) {
        const { origin, ...data } = r;
        rows.push({ table: t, id: r.id, updated_at: r.updated_at, data });
      }
      for (const tomb of db.prepare("SELECT row_id, deleted_at FROM tombstones WHERE table_name = ? AND origin = 'local' AND deleted_at > ? ORDER BY deleted_at ASC").all(t, gs.last_pushed_at)) {
        rows.push({ table: t, id: tomb.row_id, updated_at: tomb.deleted_at, deleted: true });
      }
    }
    let hasRejected = false;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const resp = await http('POST', '/api/sync/push', { body: { clientId: 'copie-locale', rows: chunk } });
      stats.pushed += resp.applied || 0;
      stats.conflicts += resp.conflicts || 0;
      stats.rejected += resp.rejected || 0;
      for (const r of resp.results || []) {
        if (r.status === 'conflict' && r.row) {
          const { origin, updated_at, ...data } = r.row;
          applyRow(r.table, r.id, data, r.row.updated_at, 'prod');
        } else if (r.status === 'rejected' && r.reason === 'ligne supprimée plus récemment' && r.serverTs) {
          applyDelete(r.table, r.id, r.serverTs, 'prod');
        }
      }
      if (resp.rejected) hasRejected = true;
    }

    // ---- PUSH : médias ----
    if (!hasRejected) {
      const mediaRows = db.prepare("SELECT * FROM media WHERE origin = 'local' AND updated_at > ?").all(gs.last_pushed_at);
      const manifest = [];
      const byUrl = new Map();
      for (const m of mediaRows) {
        const p = mediaPath(m.url);
        if (!p || !fs.existsSync(p.full)) continue;
        manifest.push({ url: m.url, size: fs.statSync(p.full).size, sha256: fileSha(p.full) });
        byUrl.set(m.url, p);
      }
      if (manifest.length) {
        const mf = await http('POST', '/api/sync/media/manifest', { body: { files: manifest } });
        for (const f of mf.files || []) {
          if (!f.needs || f.needs === 'invalid') continue;
          const p = byUrl.get(f.url);
          if (!p) continue;
          await http('PUT', `/api/sync/media/upload?url=${encodeURIComponent(f.url)}&sha256=${fileSha(p.full)}`, { raw: fs.readFileSync(p.full) });
          stats.mediaUp++;
        }
      }
      for (const m of mediaRows) {
        const p = mediaPath(m.url);
        if (!p || !fs.existsSync(p.full)) hasRejected = true;
      }
    }
    if (!hasRejected) syncStateSet('_global', { last_pushed_at: nowSec() });

    // ---- PULL ----
    const since = gs.last_pulled_at;
    const pull = await http('GET', `/api/sync/pull?since=${since}`);
    const pulledTables = {};
    for (const [table, rowsR] of Object.entries(pull.tables || {})) {
      pulledTables[table] = rowsR.length;
      for (const r of rowsR) {
        const { origin, updated_at, ...data } = r;
        const res = applyRow(table, r.id, data, r.updated_at, 'prod');
        if (res.status === 'applied') stats.pulled++;
      }
    }
    for (const t of pull.tombstones || []) {
      const res = applyDelete(t.table, t.id, t.deleted_at, 'prod');
      if (res.status === 'applied') stats.pulled++;
    }
    syncStateSet('_global', { last_pulled_at: pull.serverTime || nowSec() });

    // ---- PULL : médias ----
    const mediaRows = (pull.tables?.media || []).filter((m) => m.updated_at > since);
    for (const m of mediaRows) {
      const p = mediaPath(m.url);
      if (!p) continue;
      try {
        if (fs.existsSync(p.full) && fs.statSync(p.full).size === Number(m.size)) continue;
        const fr = await fetch(state.url.replace(/\/+$/, '') + m.url);
        if (!fr.ok) continue;
        const buf = Buffer.from(await fr.arrayBuffer());
        fs.mkdirSync(path.dirname(p.full), { recursive: true });
        const tmp = p.full + '.tmp-' + crypto.randomBytes(4).toString('hex');
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, p.full);
        stats.mediaDn++;
      } catch { /* le fichier sera retenté au prochain cycle */ }
    }
    // suppression locale des médias dont la ligne a été retirée
    for (const t of pull.tombstones || []) {
      if (t.table !== 'media') continue;
      const m = db.prepare('SELECT url FROM media WHERE id = ?').get(t.id);
      if (!m) continue;
      const p = mediaPath(m.url);
      if (p && fs.existsSync(p.full) && p.rel !== 'seed/' + path.basename(p.rel)) {
        try { fs.unlinkSync(p.full); } catch { /* déjà parti */ }
      }
    }

    logSync('copie-locale', 'cycle', Object.keys(pulledTables).join(','), stats.pushed + stats.pulled, stats.pushed + stats.pulled, stats.conflicts, stats.rejected, `media↑${stats.mediaUp} ↓${stats.mediaDn}`);
    state.lastStats = stats;
    return { ok: true, ...stats };
  } catch (e) {
    state.lastError = String(e.message || e).slice(0, 300);
    return { ok: false, error: state.lastError };
  } finally {
    state.running = false;
    state.lastRunAt = nowSec();
  }
}

let timer = null;
export function syncWorkerStart() {
  if (process.env.LOCAL_COPY !== '1' || timer) return;
  const loop = async () => {
    try {
      if (state.url && state.token && !state.running) {
        const r = await syncWorkerRun();
        if (r.ok) console.log(`[sync] cycle terminé : push=${r.pushed} pull=${r.pulled} conflits=${r.conflicts} médias↑${r.mediaUp} ↓${r.mediaDn}`);
        else console.warn(`[sync] échec : ${r.error}`);
      }
    } catch (e) {
      console.error('[sync]', e);
    }
    timer = setTimeout(loop, state.intervalMs);
  };
  timer = setTimeout(loop, 15000);
}
