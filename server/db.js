import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'adiong.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Administrateur',
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS causes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  long_content TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'megaphone',
  image TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'actualites',
  image TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'ADI ONG',
  date TEXT NOT NULL DEFAULT (date('now')),
  published INTEGER NOT NULL DEFAULT 1,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  seo_image TEXT NOT NULL DEFAULT '',
  seo_noindex INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  goal_amount REAL NOT NULL DEFAULT 0,
  collected_amount REAL NOT NULL DEFAULT 0,
  deadline TEXT NOT NULL DEFAULT '',
  cause_slug TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER,
  donor_name TEXT NOT NULL DEFAULT '',
  donor_email TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nouvelle',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  thumb TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  mime TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  department_id INTEGER,
  contract_type TEXT NOT NULL DEFAULT 'permanent',
  hire_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'actif',
  leave_date TEXT NOT NULL DEFAULT '',
  salary REAL,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  photo TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'conge',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'en_attente',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'editor',
  label TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const migrate = (sql) => { try { db.exec(sql); } catch {  } };
migrate("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
migrate('ALTER TABLE articles ADD COLUMN seo_title TEXT NOT NULL DEFAULT \'\'');
migrate("ALTER TABLE articles ADD COLUMN seo_description TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE articles ADD COLUMN seo_image TEXT NOT NULL DEFAULT ''");
migrate('ALTER TABLE articles ADD COLUMN seo_noindex INTEGER NOT NULL DEFAULT 0');
migrate("ALTER TABLE media ADD COLUMN alt TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE users ADD COLUMN photo TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE users ADD COLUMN job_title TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE users ADD COLUMN unique_code TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
try { db.prepare("UPDATE users SET role = 'super_admin' WHERE email = 'admin@adiong.org' AND role = 'admin'").run(); } catch { /* déjà fait */ }

export function newUniqueCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let n = 0; n < 30; n++) {
    let code = 'ADI-';
    for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!db.prepare('SELECT id FROM users WHERE unique_code = ?').get(code)) return code;
  }
  return `ADI-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function ensureUserCodes() {
  const missing = db.prepare("SELECT id FROM users WHERE unique_code IS NULL OR unique_code = ''").all();
  const setCode = db.prepare('UPDATE users SET unique_code = ? WHERE id = ?');
  for (const row of missing) setCode.run(newUniqueCode(), row.id);
}

ensureUserCodes();
migrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_code ON users(unique_code)');

db.exec(`
CREATE TABLE IF NOT EXISTS grh_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  file TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  base_salary REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  bonus_label TEXT NOT NULL DEFAULT '',
  deductions REAL NOT NULL DEFAULT 0,
  deductions_label TEXT NOT NULL DEFAULT '',
  net REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'brouillon',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, month)
);

CREATE TABLE IF NOT EXISTS grh_salary_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  old_salary REAL,
  new_salary REAL NOT NULL,
  effective_date TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  department_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  contract_type TEXT NOT NULL DEFAULT 'permanent',
  location TEXT NOT NULL DEFAULT '',
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  published INTEGER NOT NULL DEFAULT 1,
  deadline TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'recu',
  cv_file TEXT NOT NULL DEFAULT '',
  interview_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  hired_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  criteria TEXT NOT NULL DEFAULT '[]',
  overall REAL NOT NULL DEFAULT 0,
  comments TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'brouillon',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_trainings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'externe',
  provider TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  cost REAL,
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_training_attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'inscrit',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (training_id, employee_id)
);

CREATE TABLE IF NOT EXISTS grh_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'planifie',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_project_members (
  project_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  PRIMARY KEY (project_id, employee_id)
);

CREATE TABLE IF NOT EXISTS grh_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  project_id INTEGER,
  assignee_id INTEGER,
  priority TEXT NOT NULL DEFAULT 'normale',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'a_faire',
  created_by INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_task_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  author_id INTEGER,
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grh_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  sender TEXT NOT NULL,
  user_id INTEGER,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS grh_admin_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
  file TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  expires_on TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  price REAL NOT NULL DEFAULT 0,
  cost REAL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'entree',
  qty INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER,
  reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pos_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'especes',
  paid_amount REAL NOT NULL DEFAULT 0,
  cashier_id INTEGER,
  status TEXT NOT NULL DEFAULT 'vendue',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  returned_qty INTEGER NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pos_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pos_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  sale_item_id INTEGER NOT NULL,
  product_id INTEGER,
  qty INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'mobile',
  status TEXT NOT NULL DEFAULT 'attente',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
migrate('ALTER TABLE grh_employees ADD COLUMN manager_id INTEGER');
migrate('ALTER TABLE grh_employees ADD COLUMN annual_days INTEGER NOT NULL DEFAULT 0');
migrate("ALTER TABLE grh_employees ADD COLUMN job_description TEXT NOT NULL DEFAULT ''");
migrate('ALTER TABLE grh_leaves ADD COLUMN days INTEGER NOT NULL DEFAULT 0');
migrate("ALTER TABLE stock_products ADD COLUMN barcode TEXT NOT NULL DEFAULT ''");
migrate("CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_products_barcode_unique ON stock_products(barcode) WHERE barcode != ''");
migrate("ALTER TABLE donations ADD COLUMN reference TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE donations ADD COLUMN method TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE donations ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
migrate("ALTER TABLE donations ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0");
migrate("ALTER TABLE donations ADD COLUMN proof TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE donations ADD COLUMN proof_name TEXT NOT NULL DEFAULT ''");
migrate("ALTER TABLE donations ADD COLUMN tx_ref TEXT NOT NULL DEFAULT ''");
migrate("CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_reference ON donations(reference) WHERE reference != ''");
migrate(`CREATE TABLE IF NOT EXISTS grh_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  clock_in TEXT NOT NULL DEFAULT '',
  last_seen TEXT NOT NULL DEFAULT '',
  clock_out TEXT NOT NULL DEFAULT '',
  corrected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, date)
)`);
migrate("CREATE INDEX IF NOT EXISTS idx_grh_attendance_date ON grh_attendance(date)");
migrate(`CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  area TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (role, area)
)`);
// Droits par défaut : seed une seule fois (INSERT OR IGNORE) — nouvelles zones ajoutées sans écraser les réglages existants
const permSeed = db.prepare('INSERT OR IGNORE INTO role_permissions (role, area, enabled) VALUES (?, ?, ?)');
for (const [role, area, on] of [
  // super_admin : tout (même si le code force déjà true)
  ['super_admin', 'dashboard', 1], ['super_admin', 'chat', 1], ['super_admin', 'inbox', 1], ['super_admin', 'donations', 1],
  ['super_admin', 'content', 1], ['super_admin', 'media', 1], ['super_admin', 'grh', 1], ['super_admin', 'leave', 1],
  ['super_admin', 'pos', 1], ['super_admin', 'users', 1], ['super_admin', 'settings', 1],
  // admin
  ['admin', 'dashboard', 1], ['admin', 'chat', 1], ['admin', 'inbox', 1], ['admin', 'donations', 1],
  ['admin', 'content', 1], ['admin', 'media', 1], ['admin', 'grh', 1], ['admin', 'leave', 1],
  ['admin', 'pos', 1], ['admin', 'users', 1], ['admin', 'settings', 1],
  // editor
  ['editor', 'dashboard', 1], ['editor', 'chat', 1], ['editor', 'inbox', 1], ['editor', 'donations', 1],
  ['editor', 'content', 1], ['editor', 'media', 1], ['editor', 'grh', 0], ['editor', 'leave', 1],
  ['editor', 'pos', 0], ['editor', 'users', 0], ['editor', 'settings', 0],
  // viewer
  ['viewer', 'dashboard', 1], ['viewer', 'chat', 1], ['viewer', 'inbox', 1], ['viewer', 'donations', 1],
  ['viewer', 'content', 0], ['viewer', 'media', 0], ['viewer', 'grh', 0], ['viewer', 'leave', 1],
  ['viewer', 'pos', 0], ['viewer', 'users', 0], ['viewer', 'settings', 0],
  // cashier
  ['cashier', 'dashboard', 1], ['cashier', 'chat', 1], ['cashier', 'inbox', 0], ['cashier', 'donations', 0],
  ['cashier', 'content', 0], ['cashier', 'media', 0], ['cashier', 'grh', 0], ['cashier', 'leave', 0],
  ['cashier', 'pos', 1], ['cashier', 'users', 0], ['cashier', 'settings', 0],
  // compat anciennes clés (backoffice → ignorées si la UI ne les affiche plus)
  ['super_admin', 'backoffice', 1], ['admin', 'backoffice', 1], ['editor', 'backoffice', 1], ['viewer', 'backoffice', 1], ['cashier', 'backoffice', 1]
]) permSeed.run(role, area, on);

migrate(`CREATE TABLE IF NOT EXISTS chat_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'dm',
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  join_policy TEXT NOT NULL DEFAULT 'ferme',
  owner_id INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT NOT NULL DEFAULT '',
  last_message_body TEXT NOT NULL DEFAULT '',
  last_message_sender TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
migrate(`CREATE TABLE IF NOT EXISTS chat_members (
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'membre',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, user_id)
)`);
migrate(`CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attachment TEXT NOT NULL DEFAULT '',
  attachment_name TEXT NOT NULL DEFAULT '',
  attachment_mime TEXT NOT NULL DEFAULT '',
  reply_to INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT NOT NULL DEFAULT '',
  deleted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
migrate('CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, id)');
migrate('ALTER TABLE chat_conversations ADD COLUMN last_typing_at TEXT NOT NULL DEFAULT \'\'');
migrate('ALTER TABLE chat_conversations ADD COLUMN last_typing_name TEXT NOT NULL DEFAULT \'\'');
migrate('ALTER TABLE chat_conversations ADD COLUMN last_typing_by INTEGER NOT NULL DEFAULT 0');
migrate(`CREATE TABLE IF NOT EXISTS chat_reactions (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
)`);
migrate(`CREATE TABLE IF NOT EXISTS chat_pins (
  conversation_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by INTEGER NOT NULL DEFAULT 0,
  pinned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, message_id)
)`);
migrate(`CREATE TABLE IF NOT EXISTS chat_reads (
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
)`);

/** Bascule la messagerie d’équipe : membres = comptes users, plus fiches GRH. */
(() => {
  try {
    const cols = db.prepare('PRAGMA table_info(chat_members)').all();
    if (cols.some((c) => c.name === 'user_id')) return;
    db.exec(`
      CREATE TABLE chat_members_u (
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'membre',
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (conversation_id, user_id)
      );
      CREATE TABLE chat_reads_u (
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        read_at TEXT NOT NULL,
        PRIMARY KEY (conversation_id, user_id)
      );
    `);
    const userByEmp = (empId) => {
      const emp = db.prepare('SELECT email FROM grh_employees WHERE id = ?').get(empId);
      if (!emp?.email) return null;
      return db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(emp.email);
    };
    const insM = db.prepare('INSERT OR IGNORE INTO chat_members_u (conversation_id, user_id, role, joined_at) VALUES (?,?,?,?)');
    for (const m of db.prepare('SELECT * FROM chat_members').all()) {
      const u = userByEmp(m.employee_id);
      if (!u) continue;
      const role = m.role === 'propietaire' ? 'proprietaire' : (m.role || 'membre');
      insM.run(m.conversation_id, u.id, role, m.joined_at || '');
    }
    const insR = db.prepare('INSERT OR IGNORE INTO chat_reads_u (conversation_id, user_id, read_at) VALUES (?,?,?)');
    for (const r of db.prepare('SELECT * FROM chat_reads').all()) {
      const u = userByEmp(r.employee_id);
      if (u) insR.run(r.conversation_id, u.id, r.read_at);
    }
    const updMsg = db.prepare('UPDATE chat_messages SET sender_id = ? WHERE id = ?');
    for (const m of db.prepare('SELECT id, sender_id FROM chat_messages').all()) {
      const u = userByEmp(m.sender_id);
      if (u) updMsg.run(u.id, m.id);
    }
    const updConv = db.prepare('UPDATE chat_conversations SET owner_id = ?, created_by = ? WHERE id = ?');
    for (const c of db.prepare('SELECT id, owner_id, created_by FROM chat_conversations').all()) {
      const o = userByEmp(c.owner_id)?.id || c.owner_id;
      const cr = userByEmp(c.created_by)?.id || c.created_by;
      updConv.run(o, cr, c.id);
    }
    db.exec(`
      DROP TABLE chat_members;
      DROP TABLE chat_reads;
      ALTER TABLE chat_members_u RENAME TO chat_members;
      ALTER TABLE chat_reads_u RENAME TO chat_reads;
    `);
  } catch (e) {
    console.error('[chat migrate user_id]', e.message);
  }
})();
migrate('ALTER TABLE chat_members ADD COLUMN muted INTEGER NOT NULL DEFAULT 0');

/** Réactions : employee_id → user_id */
(() => {
  try {
    const cols = db.prepare('PRAGMA table_info(chat_reactions)').all();
    if (!cols.length || cols.some((c) => c.name === 'user_id')) return;
    if (!cols.some((c) => c.name === 'employee_id')) return;
    db.exec(`
      CREATE TABLE chat_reactions_u (
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        PRIMARY KEY (message_id, user_id)
      );
    `);
    const userByEmp = (empId) => {
      const emp = db.prepare('SELECT email FROM grh_employees WHERE id = ?').get(empId);
      if (!emp?.email) return null;
      return db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(emp.email);
    };
    const ins = db.prepare('INSERT OR IGNORE INTO chat_reactions_u (message_id, user_id, emoji) VALUES (?,?,?)');
    for (const r of db.prepare('SELECT * FROM chat_reactions').all()) {
      const u = userByEmp(r.employee_id);
      if (u) ins.run(r.message_id, u.id, r.emoji);
    }
    db.exec(`DROP TABLE chat_reactions; ALTER TABLE chat_reactions_u RENAME TO chat_reactions;`);
  } catch (e) {
    console.error('[chat migrate reactions]', e.message);
  }
})();

migrate(`CREATE TABLE IF NOT EXISTS article_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

function ensureArticleCategories() {
  const ins = db.prepare('INSERT OR IGNORE INTO article_categories (slug, name, sort_order) VALUES (?, ?, ?)');
  for (const [slug, name, order] of [
    ['plaidoyer', 'Plaidoyer', 10],
    ['education', 'Éducation', 20],
    ['ecologie', 'Écologie', 30],
    ['socio_economique', 'Socio-économique', 40],
    ['entrepreneuriat', 'Entrepreneuriat', 50],
    ['actualites', 'Actualité', 60]
  ]) ins.run(slug, name, order);

  const used = db.prepare("SELECT DISTINCT category AS slug FROM articles WHERE category IS NOT NULL AND TRIM(category) != ''").all();
  let extra = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM article_categories').get().n;
  for (const row of used) {
    if (db.prepare('SELECT id FROM article_categories WHERE slug = ?').get(row.slug)) continue;
    extra += 10;
    const name = String(row.slug).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    ins.run(row.slug, name, extra);
  }
}
migrate(`CREATE TABLE IF NOT EXISTS acc_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  nature TEXT NOT NULL DEFAULT 'expense',
  class INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
migrate(`CREATE TABLE IF NOT EXISTS acc_journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
)`);
migrate(`CREATE TABLE IF NOT EXISTS acc_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  journal_code TEXT NOT NULL,
  ref TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  source_id INTEGER NOT NULL DEFAULT 0,
  is_reversal_of INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
migrate('CREATE INDEX IF NOT EXISTS idx_acc_entries_date ON acc_entries(date)');
migrate('CREATE UNIQUE INDEX IF NOT EXISTS idx_acc_entries_source ON acc_entries(source, source_id) WHERE source != \'manual\'');
migrate(`CREATE TABLE IF NOT EXISTS acc_entry_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  account_code TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0
)`);
migrate('CREATE INDEX IF NOT EXISTS idx_acc_lines_entry ON acc_entry_lines(entry_id)');
migrate('CREATE INDEX IF NOT EXISTS idx_acc_lines_account ON acc_entry_lines(account_code, entry_id)');

function ensureComptaSeed() {
  const journals = [['O', 'Ouverture'], ['ACH', 'Achats'], ['VEN', 'Ventes & ressources'], ['CAI', 'Caisse'], ['BQ', 'Banque'], ['OD', 'Opérations diverses']];
  const insJ = db.prepare('INSERT OR IGNORE INTO acc_journals (code, name) VALUES (?, ?)');
  for (const [code, name] of journals) insJ.run(code, name);

  if (db.prepare('SELECT COUNT(*) AS n FROM acc_accounts').get().n > 0) return;
  const ACCOUNTS = [
    ['101', 'Dotation fondatrice', 'equity', 1],
    ['102', 'Autres versements des fondateurs', 'equity', 1],
    ['151', 'Réserves statutaires', 'equity', 1],
    ['152', 'Réserves libres', 'equity', 1],
    ['165', 'Subventions d\'investissement perçues', 'equity', 1],
    ['168', 'Déficit de l\'exercice (transit)', 'equity', 1],
    ['171', 'Surplus reporté (exercice précédent)', 'equity', 1],
    ['178', 'Surplus de l\'exercice (transit)', 'equity', 1],
    ['211', 'Logiciels et brevets', 'asset', 2],
    ['221', 'Terrains', 'asset', 2],
    ['231', 'Bâtiments', 'asset', 2],
    ['232', 'Travaux et agencements', 'asset', 2],
    ['241', 'Matériel et mobilier de bureau', 'asset', 2],
    ['243', 'Moyens de transport', 'asset', 2],
    ['281', 'Amortissements — matériel', 'asset', 2],
    ['283', 'Amortissements — transport', 'asset', 2],
    ['291', 'Dépréciations — immobilisations', 'asset', 2],
    ['311', 'Fournitures et consommables', 'asset', 3],
    ['371', 'Produits destinés aux bénéficiaires', 'asset', 3],
    ['391', 'Dépréciations — stocks', 'asset', 3],
    ['411', 'Membres', 'liability', 4],
    ['418', 'Divers créanciers / débiteurs', 'liability', 4],
    ['419', 'Membres en attente (suspens)', 'liability', 4],
    ['421', 'Personnel (à payer)', 'liability', 4],
    ['441', 'État', 'liability', 4],
    ['445', 'TVA déductible', 'liability', 4],
    ['446', 'Autres impôts et taxes', 'liability', 4],
    ['447', 'Sécurité sociale', 'liability', 4],
    ['451', 'Fondateurs et contributeurs', 'liability', 4],
    ['456', 'Comptes courants', 'liability', 4],
    ['461', 'Donateurs (différés)', 'liability', 4],
    ['465', 'Fonds affectés et fonds de gestion', 'liability', 4],
    ['468', 'Divers débiteurs / créditeurs', 'liability', 4],
    ['485', 'Charges sociales à payer', 'liability', 4],
    ['488', 'Divers à payer', 'liability', 4],
    ['511', 'Banque — compte principal', 'asset', 5],
    ['512', 'Banque — comptes projets', 'asset', 5],
    ['516', 'Mobile Money', 'asset', 5],
    ['5161', 'Mobile Money — Airtel', 'asset', 5],
    ['5162', 'Mobile Money — M-Pesa', 'asset', 5],
    ['5163', 'Mobile Money — Orange', 'asset', 5],
    ['531', 'Caisse', 'asset', 5],
    ['581', 'Banque en attente (suspens)', 'asset', 5],
    ['601', 'Achats de matières et fournitures', 'expense', 6],
    ['611', 'Services extérieurs', 'expense', 6],
    ['613', 'Locations', 'expense', 6],
    ['615', 'Primes d\'assurance', 'expense', 6],
    ['616', 'Honoraires, audits et expertises', 'expense', 6],
    ['618', 'Autres services extérieurs', 'expense', 6],
    ['621', 'Déplacements et représentation', 'expense', 6],
    ['622', 'Transports', 'expense', 6],
    ['623', 'Postes et télécommunications', 'expense', 6],
    ['626', 'Publicité et communication', 'expense', 6],
    ['631', 'Impôts et taxes', 'expense', 6],
    ['641', 'Salaires et traitements', 'expense', 6],
    ['642', 'Charges sociales sur salaires', 'expense', 6],
    ['648', 'Autres charges de personnel', 'expense', 6],
    ['651', 'Dotations aux amortissements', 'expense', 6],
    ['653', 'Dotations aux provisions', 'expense', 6],
    ['661', 'Charges financières', 'expense', 6],
    ['665', 'Frais bancaires et de transaction', 'expense', 6],
    ['701', 'Cotisations des membres', 'income', 7],
    ['703', 'Ressources des activités et prestations', 'income', 7],
    ['704', 'Ressources de formations et événements', 'income', 7],
    ['741', 'Subventions d\'exploitation', 'income', 7],
    ['749', 'Dons et legs — fonds général', 'income', 7],
    ['7491', 'Dons affectés à un projet', 'income', 7],
    ['761', 'Produits financiers', 'income', 7],
    ['811', 'Charges exceptionnelles', 'expense', 8],
    ['813', 'Insuffisances sur cessions', 'expense', 8],
    ['821', 'Gains sur cessions d\'actifs', 'income', 8],
    ['827', 'Produits exceptionnels', 'income', 8],
    ['911', 'Contributions en nature — charges', 'expense', 9],
    ['971', 'Contributions en nature — ressources', 'income', 9]
  ];
  const insA = db.prepare('INSERT OR IGNORE INTO acc_accounts (code, name, nature, class, is_system) VALUES (?, ?, ?, ?, 1)');
  for (const [code, name, nature, cls] of ACCOUNTS) insA.run(code, name, nature, cls);
}
ensureComptaSeed();

export default db;
