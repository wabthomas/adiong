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
`);
migrate('ALTER TABLE grh_employees ADD COLUMN manager_id INTEGER');
migrate('ALTER TABLE grh_employees ADD COLUMN annual_days INTEGER NOT NULL DEFAULT 0');
migrate("ALTER TABLE grh_employees ADD COLUMN job_description TEXT NOT NULL DEFAULT ''");
migrate('ALTER TABLE grh_leaves ADD COLUMN days INTEGER NOT NULL DEFAULT 0');

export default db;
