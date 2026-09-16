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

export default db;
