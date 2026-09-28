// ---------- Synchronisation (Phase 2) ----------
import { db } from './db.js';

export const SYNC_TABLES = {
  // contenu
  articles: { push: 1, pull: 1 },
  article_categories: { push: 1, pull: 1 },
  causes: { push: 1, pull: 1 },
  campaigns: { push: 1, pull: 1 },
  partners: { push: 1, pull: 1 },
  // dons
  donations: { push: 1, pull: 1 },
  // pos
  stock_products: { push: 1, pull: 1 },
  stock_categories: { push: 1, pull: 1 },
  stock_movements: { push: 1, pull: 1 },
  pos_sales: { push: 1, pull: 1 },
  pos_sale_items: { push: 1, pull: 1 },
  pos_returns: { push: 1, pull: 1 },
  pos_return_items: { push: 1, pull: 1 },
  shop_orders: { push: 1, pull: 1 },
  // compta
  acc_entries: { push: 1, pull: 1 },
  acc_entry_lines: { push: 1, pull: 1 },
  acc_exercises: { push: 1, pull: 1 },
  acc_in_kind: { push: 1, pull: 1 },
  acc_accounts: { push: 0, pull: 1 },
  acc_journals: { push: 0, pull: 1 },
  // grh
  grh_departments: { push: 1, pull: 1 },
  grh_employees: { push: 1, pull: 1 },
  grh_jobs: { push: 1, pull: 1 },
  grh_candidates: { push: 1, pull: 1 },
  grh_leaves: { push: 1, pull: 1 },
  grh_attendance: { push: 1, pull: 1 },
  grh_payroll: { push: 1, pull: 1 },
  grh_salary_history: { push: 1, pull: 1 },
  grh_projects: { push: 1, pull: 1 },
  grh_tasks: { push: 1, pull: 1 },
  grh_task_notes: { push: 1, pull: 1 },
  grh_evaluations: { push: 1, pull: 1 },
  grh_trainings: { push: 1, pull: 1 },
  grh_training_attendees: { push: 1, pull: 1 },
  grh_announcements: { push: 1, pull: 1 },
  grh_documents: { push: 1, pull: 1 },
  grh_admin_docs: { push: 1, pull: 1 },
  // grh_project_members : table de jointure sans id — hors synchro v1
  // médias (manifeste — les fichiers voyagent via /api/sync/media)
  media: { push: 1, pull: 1 },
  // identités (lecture seule : les comptes vivent sur la prod)
  users: { push: 0, pull: 1 },
};

export function nowSec() {
  return parseInt(db.prepare("SELECT CAST(strftime('%s','now') AS INTEGER) s").get().s, 10);
}

const isoToSec = (expr) => `CAST(strftime('%s', REPLACE(REPLACE(COALESCE(${expr}, ''), 'T', ' '), 'Z', '')) AS INTEGER)`;

// Les écritures de synchro posent updated_at/origin explicitement :
// les triggers de « écriture locale » doivent être désactivés le temps de l'application.
function withSyncFlag(fn) {
  db.prepare('INSERT OR REPLACE INTO sync_flag (k, active) VALUES (1, 1)').run();
  try { return fn(); } finally {
    db.prepare('UPDATE sync_flag SET active = 0').run();
  }
}

export function migrateSync() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_flag (
      k INTEGER PRIMARY KEY,
      active INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tombstones (
      table_name TEXT NOT NULL,
      row_id INTEGER NOT NULL,
      deleted_at INTEGER NOT NULL,
      origin TEXT NOT NULL DEFAULT 'local',
      PRIMARY KEY (table_name, row_id)
    );
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      client_id TEXT NOT NULL DEFAULT '',
      direction TEXT NOT NULL DEFAULT '',
      collections TEXT NOT NULL DEFAULT '',
      rows_count INTEGER NOT NULL DEFAULT 0,
      applied INTEGER NOT NULL DEFAULT 0,
      conflicts INTEGER NOT NULL DEFAULT 0,
      rejected INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      collection TEXT PRIMARY KEY,
      last_pulled_at INTEGER NOT NULL DEFAULT 0,
      last_pushed_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  for (const t of Object.keys(SYNC_TABLES)) {
    let cols = db.prepare(`PRAGMA table_info(${t})`).all();
    let uDef = cols.find((c) => c.name === 'updated_at');
    if (uDef && uDef.type !== 'INTEGER') {
      try { db.exec(`ALTER TABLE ${t} DROP COLUMN updated_at`); } catch { /* conservé */ }
      cols = db.prepare(`PRAGMA table_info(${t})`).all();
      uDef = cols.find((c) => c.name === 'updated_at');
    }
    const names = cols.map((c) => c.name);
    if (!names.includes('updated_at')) db.exec(`ALTER TABLE ${t} ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`);
    if (!names.includes('origin')) db.exec(`ALTER TABLE ${t} ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`);
    if (names.includes('created_at')) {
      db.exec(`UPDATE ${t} SET updated_at = ${isoToSec('created_at')} WHERE updated_at = 0 AND created_at != ''`);
    }
    db.exec(`UPDATE ${t} SET updated_at = ${nowSec()} WHERE updated_at = 0`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_sync ON ${t}(updated_at)`);
    // sync_flag à 1 : les écritures de la synchro n'ont pas à passer par les
    // triggers (updated_at/origin sont posés explicitement par applyRow/applyDelete).
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_${t}_ins AFTER INSERT ON ${t} FOR EACH ROW
      WHEN NEW.updated_at = 0 AND (SELECT COALESCE(MAX(active), 0) FROM sync_flag) = 0
      BEGIN UPDATE ${t} SET updated_at = CAST(strftime('%s','now') AS INTEGER), origin = 'local' WHERE rowid = NEW.rowid; END;
      CREATE TRIGGER IF NOT EXISTS trg_${t}_upd AFTER UPDATE ON ${t} FOR EACH ROW
      WHEN NEW.updated_at = OLD.updated_at AND (SELECT COALESCE(MAX(active), 0) FROM sync_flag) = 0
      BEGIN UPDATE ${t} SET updated_at = CAST(strftime('%s','now') AS INTEGER), origin = 'local' WHERE rowid = NEW.rowid; END;
      CREATE TRIGGER IF NOT EXISTS trg_${t}_del AFTER DELETE ON ${t} FOR EACH ROW
      BEGIN INSERT OR REPLACE INTO tombstones(table_name, row_id, deleted_at, origin) VALUES ('${t}', OLD.id, CAST(strftime('%s','now') AS INTEGER), 'local'); END;
    `);
  }

  // Nettoyage des triggers créés par une version antérieure pour des tables
  // qui ne sont plus synchronisées (ex. tables de jointure sans id).
  const trigs = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg\\_%' ESCAPE '\\'").all();
  for (const tr of trigs) {
    const t = tr.name.slice(4, tr.name.length - 4);
    if (!SYNC_TABLES[t]) {
      try { db.exec(`DROP TRIGGER IF EXISTS ${tr.name}`); } catch { /* déjà parti */ }
    }
  }

  if (process.env.LOCAL_COPY === '1') bumpIdSpaces();
}

// Espace d'ids local : les nouvelles lignes locales reçoivent un id ≥ 1e12,
// jamais utilisé par la prod (petits ids autoincrémentés).
export function bumpIdSpaces() {
  if (process.env.LOCAL_COPY !== '1') return;
  for (const [t, c] of Object.entries(SYNC_TABLES)) {
    if (!c.push) continue;
    try {
      db.prepare('INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES (?, 1000000000000)').run(t);
      db.prepare('UPDATE sqlite_sequence SET seq = MAX(seq, 1000000000000) WHERE name = ?').run(t);
    } catch { /* table sans autoincrement */ }
  }
}

// Applique une ligne reçue (push ou pull) avec LWW. Retourne le statut.
export function applyRow(table, id, data, serverTs, origin) {
  const conf = SYNC_TABLES[table];
  if (!conf) return { status: 'rejected', reason: 'table non synchronisée' };
  if (!Number.isInteger(id) || id <= 0) return { status: 'rejected', reason: 'id invalide' };
  serverTs = Number(serverTs) || 0;
  if (serverTs <= 0) return { status: 'rejected', reason: 'horodatage invalide' };
  return withSyncFlag(() => applyRowInner(table, id, data, serverTs, origin));
}

function applyRowInner(table, id, data, serverTs, origin) {
  // Les médias sont identifiés par leur filename (UNIQUE) : les ids peuvent
  // différer d'une instance à l'autre, la fusion se fait donc par filename.
  if (table === 'media') return applyMediaRow(data, serverTs, origin);

  const tomb = db.prepare('SELECT deleted_at FROM tombstones WHERE table_name = ? AND row_id = ?').get(table, id);
  const row = db.prepare(`SELECT id, updated_at FROM ${table} WHERE id = ?`).get(id);

  if (!row && !tomb) {
    db.prepare(`INSERT INTO ${table} (id, ${Object.keys(data).join(', ')}, updated_at, origin) VALUES (?, ${Object.keys(data).map(() => '?').join(', ')}, ?, ?)`)
      .run(id, ...Object.values(data), serverTs, origin);
    return { status: 'applied' };
  }
  if (!row && tomb) {
    if (serverTs > Number(tomb.deleted_at)) {
      db.prepare(`INSERT INTO ${table} (id, ${Object.keys(data).join(', ')}, updated_at, origin) VALUES (?, ${Object.keys(data).map(() => '?').join(', ')}, ?, ?)`)
        .run(id, ...Object.values(data), serverTs, origin);
      db.prepare('DELETE FROM tombstones WHERE table_name = ? AND row_id = ?').run(table, id);
      return { status: 'applied' };
    }
    return { status: 'rejected', reason: 'ligne supprimée plus récemment', serverTs: tomb.deleted_at };
  }
  if (Number(row.updated_at) < serverTs) {
    const cols = Object.keys(data);
    db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, origin = ? WHERE id = ?`)
      .run(...cols.map((c) => data[c]), serverTs, origin, id);
    return { status: 'applied' };
  }
  if (Number(row.updated_at) === serverTs) {
    // même version des deux côtés : rien à faire (et surtout pas
    // réécrire origin, qui tient la comptabilité des écritures locales)
    return { status: 'applied' };
  }
  const current = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return { status: 'conflict', reason: 'version serveur plus récente', row: current };
}

function applyMediaRow(data, serverTs, origin) {
  const filename = String(data.filename || '').trim();
  if (!filename) return { status: 'rejected', reason: 'media sans filename' };
  const { id: sentId, updated_at, ...rest } = data;
  const cols = Object.keys(rest);
  const existing = db.prepare('SELECT * FROM media WHERE filename = ?').get(filename);
  if (existing) {
    if (Number(existing.updated_at) <= serverTs) {
      db.prepare(`UPDATE media SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ?, origin = ? WHERE id = ?`)
        .run(...cols.map((c) => rest[c]), serverTs, origin, existing.id);
      return { status: 'applied' };
    }
    return { status: 'conflict', reason: 'version locale plus récente', row: existing };
  }
  const idTaken = Number.isInteger(sentId) && db.prepare('SELECT id FROM media WHERE id = ?').get(sentId);
  if (idTaken) {
    db.prepare(`INSERT INTO media (${cols.join(', ')}, updated_at, origin) VALUES (${cols.map(() => '?').join(', ')}, ?, ?)`)
      .run(...cols.map((c) => rest[c]), serverTs, origin);
  } else {
    db.prepare(`INSERT INTO media (id, ${cols.join(', ')}, updated_at, origin) VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?)`)
      .run(sentId, ...cols.map((c) => rest[c]), serverTs, origin);
  }
  return { status: 'applied' };
}

// Applique une suppression reçue (tombstone) avec LWW.
export function applyDelete(table, id, deletedTs, origin) {
  deletedTs = Number(deletedTs) || 0;
  return withSyncFlag(() => {
    const row = db.prepare(`SELECT id, updated_at FROM ${table} WHERE id = ?`).get(id);
    if (!row) return { status: 'applied' };
    if (deletedTs >= Number(row.updated_at)) {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      db.prepare('UPDATE tombstones SET deleted_at = MAX(deleted_at, ?), origin = ? WHERE table_name = ? AND row_id = ?').run(deletedTs, origin, table, id);
      return { status: 'applied' };
    }
    return { status: 'conflict', reason: 'ligne locale plus récente' };
  });
}

export function syncStateGet(collection) {
  return db.prepare('SELECT last_pulled_at, last_pushed_at FROM sync_state WHERE collection = ?').get(collection)
    || { last_pulled_at: 0, last_pushed_at: 0 };
}

export function syncStateSet(collection, fields) {
  db.prepare('INSERT INTO sync_state (collection, last_pulled_at, last_pushed_at) VALUES (?, ?, ?) '
    + 'ON CONFLICT(collection) DO UPDATE SET last_pulled_at = MAX(last_pulled_at, excluded.last_pulled_at), last_pushed_at = MAX(last_pushed_at, excluded.last_pushed_at)')
    .run(collection, fields.last_pulled_at || 0, fields.last_pushed_at || 0);
}

export function logSync(clientId, direction, collections, rowsCount, applied, conflicts, rejected, detail = '') {
  try {
    db.prepare('INSERT INTO sync_log (at, client_id, direction, collections, rows_count, applied, conflicts, rejected, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(nowSec(), String(clientId || '').slice(0, 100), direction, String(collections || '').slice(0, 500), rowsCount, applied, conflicts, rejected, String(detail || '').slice(0, 2000));
    db.exec('DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY id DESC LIMIT 2000)');
  } catch { /* journal non bloquant */ }
}
