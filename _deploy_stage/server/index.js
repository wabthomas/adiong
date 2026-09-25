import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import multer from 'multer';
import Jimp from 'jimp';
import QRCode from 'qrcode';
import { fileURLToPath } from 'node:url';
import db, { newUniqueCode, ensureUserCodes } from './db.js';
import { seedIfEmpty, ensureSettings, syncMediaLibrary } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(__dirname, 'data', '.jwt-secret');
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}
const JWT_SECRET = loadSecret();

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || (process.env[m[1]] != null && process.env[m[1]] !== '')) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch { /* ignore */ }
}
loadDotEnv();

ensureSettings();
seedIfEmpty();
ensureUserCodes();
// Pas de top-level await : Passenger N0C exige un listen() pendant le chargement sync du startup file.
void syncMediaLibrary().catch((e) => console.error('[media sync]', e));

const app = express();
app.use(helmet(process.env.NODE_ENV === 'production' ? {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-site' }
} : { contentSecurityPolicy: false }));

/** Origines autorisées : absente (curl / same-origin sans header) + BASE_URL + localhost en dev. */
const corsOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = new Set();
  const add = (u) => {
    try {
      if (u) allowed.add(new URL(u).origin);
    } catch { /* ignore URL invalide */ }
  };
  add(process.env.BASE_URL);
  add(process.env.CORS_ORIGIN);
  if (process.env.NODE_ENV !== 'production') {
    for (const host of ['localhost', '127.0.0.1']) {
      for (const port of [5173, 4173, 4000]) allowed.add(`http://${host}:${port}`);
    }
  }
  return allowed.has(origin);
};
app.use(cors({
  origin: (origin, cb) => cb(null, corsOriginAllowed(origin)),
  credentials: false
}));
app.use(express.json({ limit: '2mb' }));

// Chemins typiques des scanners WordPress (l'ancien site en était victime) → 404 uniforme
const SUSPICIOUS_PATHS = [
  /^\/wp-/, /^\/xmlrpc\.php/, /^\/wp-admin/, /^\/wp-login/, /^\/wp-content/, /^\/wp-includes/,
  /^\/\.env/, /^\/\.git/, /^\/\.htaccess/, /^\/\.htpasswd/, /^\/cgi-bin/, /^\/phpmyadmin/,
  /^\/administrator/, /^\/install/, /^\/setup\.php/, /^\/config\.php/, /^\/license\.txt/
];
app.use((req, res, next) => {
  if (SUSPICIOUS_PATHS.some((r) => r.test(req.path))) return res.status(404).send('Not Found');
  next();
});

// Limitation de débit (fenêtre glissante simple, en mémoire)
const buckets = new Map();
const rateLimit = ({ windowMs, max, key = (req) => req.ip, message = 'Trop de requêtes — réessayez plus tard.' }) =>
  (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(k, b);
    }
    b.count += 1;
    if (b.count > max) {
      res.set('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 60_000).unref();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, key: (req) => `login:${req.ip}:${String(req.body?.email || '').toLowerCase()}`, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
const contactLimiter = rateLimit({ windowMs: 60 * 60_000, max: 5, key: (req) => `contact:${req.ip}`, message: 'Trop de messages envoyés depuis votre connexion. Réessayez dans une heure.' });
const donateLimiter = rateLimit({ windowMs: 60 * 60_000, max: 30, key: (req) => `donate:${req.ip}`, message: 'Trop de dons enregistrés depuis votre connexion. Réessayez dans une heure.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `register:${req.ip}`, message: 'Trop de tentatives d’inscription. Réessayez plus tard.' });

// Limiteur global de l'API (filet de sécurité anti scan/brute-force)
app.use('/api', rateLimit({ windowMs: 15 * 60_000, max: 600, key: (req) => `api:${req.ip}`, message: 'Trop de requêtes depuis votre connexion. Réessayez plus tard.' }));

// Envoi d'emails (SMTP). Sans configuration, le message est seulement journalisé
// pour ne jamais faire échouer la requête.
// Env : SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true/false), SMTP_USER, SMTP_PASS,
//       MAIL_FROM, MAIL_TO (destinataire des notifications, défaut = email du site).
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined
  });
}
const notifyEmail = (subject, html) => {
  const to = process.env.MAIL_TO || getSetting('email') || '';
  if (!transporter || !to) {
    console.log(`[mail] (non configuré) ${subject}\n${String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}\n`);
    return Promise.resolve();
  }
  return transporter
    .sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || 'notifications@adiong.org',
      to,
      subject,
      html
    })
    .then(() => console.log(`[mail] envoyé : ${subject}`))
    .catch((e) => console.error(`[mail] échec : ${e.message}`));
};

const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);

const safeUnlink = (full) => {
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    console.error('[unlink]', full, e.message);
  }
};

const STRING_SETTINGS = [
  'grh_annual_leave_days',
  'site_name','site_tagline','logo','favicon','address','phone1','phone2','email','whatsapp','facebook','twitter',
  'instagram','pinterest','video_url','copyright','footer_credit','currency',
  'pay_airtel','pay_mpesa','pay_orange','pay_card','pay_note',
  'seo_title','seo_description','seo_keywords','og_image','twitter_handle',
  'hero_image','hero_kicker','hero_title','hero_text','hero_badge_title','hero_badge_sub','about_image',
  'mission_title','mission_text','home_mission_heading',
  'home_work_kicker','home_work_title','home_work_text',
  'home_news_kicker','home_news_title','home_news_text',
  'cta_kicker','cta_title','cta_text',
  'about_title','about_text',
  'about_values_kicker','about_values_title',
  'about_method_kicker','about_method_title','about_method_text',
  'about_presence_title','about_presence_text',
  'about_career_title','about_career_text',
  'menu_footer_title','menu_footer_work_title','menu_donate_label','menu_donate_to'
];

const JSON_SETTINGS = {
  stats: [], values: [], method: [],
  marquee_items: [], donate_amounts: [], donate_why_points: [], campaign_points: [],
  about_header: {}, work_header: {}, news_header: {}, campaigns_header: {}, donate_header: {}, contact_header: {},
  menu_header: [
    { label: 'Accueil', to: '/', mega: '' },
    { label: 'À propos', to: '/a-propos', mega: 'about' },
    { label: 'Notre travail', to: '/notre-travail', mega: 'work' },
    { label: 'Actualités', to: '/actualites', mega: 'news' },
    { label: 'Collectes', to: '/collectes', mega: 'campaigns' },
    { label: 'Contact', to: '/contact', mega: '' }
  ],
  menu_footer: [
    { label: 'Accueil', to: '/' },
    { label: 'À propos', to: '/a-propos' },
    { label: 'Actualités', to: '/actualites' },
    { label: 'Nos collectes', to: '/collectes' },
    { label: 'Contact', to: '/contact' }
  ],
  menu_mobile: [
    { label: 'Accueil', to: '/' },
    { label: 'Actus', to: '/actualites' },
    { label: 'Don', to: '/faire-un-don' },
    { label: 'Collectes', to: '/collectes' },
    { label: 'Contact', to: '/contact' }
  ]
};

const parseSetting = (raw, fallback) => {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

export const publicSite = () => {
  const out = {};
  for (const k of STRING_SETTINGS) out[k] = getSetting(k);
  for (const [k, fallback] of Object.entries(JSON_SETTINGS)) out[k] = parseSetting(getSetting(k), fallback);
  try {
    out.article_categories = db.prepare(
      'SELECT slug, name, sort_order FROM article_categories ORDER BY sort_order, name'
    ).all();
  } catch {
    out.article_categories = [];
  }
  return out;
};

const tokenHash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const revokedTokens = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [h, exp] of revokedTokens) if (exp < now) revokedTokens.delete(h);
}, 15 * 60_000).unref();

const logSecurity = (type, ip, email = '', detail = '') => {
  try {
    db.prepare('INSERT INTO security_events (type, ip, email, detail) VALUES (?, ?, ?, ?)')
      .run(type, String(ip || ''), String(email || ''), String(detail || '').slice(0, 200));
  } catch { /* non bloquant */ }
};

const authRequired = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  if (revokedTokens.has(tokenHash(token))) return res.status(401).json({ error: 'Session révoquée, reconnectez-vous' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const fresh = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    req.user.role = fresh?.role || 'viewer';
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
  }
};

const ROLES = {
  super: ['super_admin'],
  admin: ['super_admin', 'admin'],
  content: ['super_admin', 'admin', 'editor'],
  hr: ['super_admin', 'admin'],
  pos: ['super_admin', 'admin', 'cashier'],
  any: ['super_admin', 'admin', 'editor', 'viewer', 'cashier']
};
// Droits fins par catégorie de fonction (comme Kivu Business Car). Le super admin conserve toujours tout.
const PERM_GROUPS = [
  { id: 'platform', label: 'Plateforme' },
  { id: 'content', label: 'Contenu' },
  { id: 'media', label: 'Médiathèque' },
  { id: 'donations', label: 'Dons' },
  { id: 'inbox', label: 'Boîte contact' },
  { id: 'chat', label: 'Messages' },
  { id: 'grh', label: 'Ressources humaines' },
  { id: 'leave', label: 'Mon espace' },
  { id: 'pos', label: 'Point de vente' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'settings', label: 'Paramètres' }
];
const PERM_AREAS = [
  { id: 'dashboard.view', group: 'platform', label: 'Voir le tableau de bord' },
  { id: 'security.view', group: 'platform', label: 'Consulter le journal de sécurité' },
  { id: 'content.view', group: 'content', label: 'Consulter le contenu' },
  { id: 'content.create', group: 'content', label: 'Créer articles, causes, campagnes, partenaires' },
  { id: 'content.edit', group: 'content', label: 'Modifier le contenu' },
  { id: 'content.delete', group: 'content', label: 'Supprimer le contenu' },
  { id: 'media.view', group: 'media', label: 'Consulter la médiathèque' },
  { id: 'media.upload', group: 'media', label: 'Ajouter ou modifier des médias' },
  { id: 'media.delete', group: 'media', label: 'Supprimer des médias' },
  { id: 'donations.view', group: 'donations', label: 'Consulter les dons' },
  { id: 'donations.edit', group: 'donations', label: 'Traiter les dons' },
  { id: 'donations.delete', group: 'donations', label: 'Supprimer des dons' },
  { id: 'inbox.view', group: 'inbox', label: 'Lire les messages du site' },
  { id: 'inbox.edit', group: 'inbox', label: 'Marquer lu ou répondre' },
  { id: 'inbox.delete', group: 'inbox', label: 'Supprimer des messages' },
  { id: 'chat.view', group: 'chat', label: 'Accéder à la messagerie' },
  { id: 'chat.send', group: 'chat', label: 'Envoyer des messages' },
  { id: 'chat.groups', group: 'chat', label: 'Créer et administrer les groupes' },
  { id: 'grh.view', group: 'grh', label: 'Consulter la GRH' },
  { id: 'grh.manage', group: 'grh', label: 'Gérer équipe, congés, tâches et recrutement' },
  { id: 'grh.attendance', group: 'grh', label: 'Corriger les présences' },
  { id: 'grh.payroll', group: 'grh', label: 'Gérer la paie et les salaires' },
  { id: 'leave.view', group: 'leave', label: 'Accéder à Mon espace' },
  { id: 'leave.request', group: 'leave', label: 'Déposer une demande de congé' },
  { id: 'pos.view', group: 'pos', label: 'Accéder au point de vente' },
  { id: 'pos.sell', group: 'pos', label: 'Encaisser des ventes' },
  { id: 'pos.manage', group: 'pos', label: 'Catalogue, retours, annulations et rapports' },
  { id: 'users.view', group: 'users', label: 'Consulter les comptes' },
  { id: 'users.create', group: 'users', label: 'Créer des comptes et des invitations' },
  { id: 'users.edit', group: 'users', label: 'Modifier des comptes' },
  { id: 'users.delete', group: 'users', label: 'Supprimer des comptes' },
  { id: 'roles.manage', group: 'users', label: 'Gérer les rôles et les droits' },
  { id: 'settings.view', group: 'settings', label: 'Consulter les paramètres' },
  { id: 'settings.write', group: 'settings', label: 'Modifier les paramètres' },
  { id: 'modules.manage', group: 'settings', label: 'Activer ou désactiver les modules' }
];
/** Clé fine → ancienne zone, pour hériter d'un réglage déjà enregistré. */
const permParent = (id) => {
  if (id === 'security.view' || id === 'roles.manage' || id.startsWith('users.')) return 'users';
  if (id === 'modules.manage' || id.startsWith('settings.')) return 'settings';
  if (id === 'dashboard.view') return 'dashboard';
  const base = id.split('.')[0];
  return base === id ? null : base;
};
/** Ces droits ne suivent pas la zone parente : réservés par défaut. */
const PERM_RESTRICT = {
  'grh.payroll': ['super_admin'],
  'roles.manage': ['super_admin'],
  'modules.manage': ['super_admin'],
  'chat.groups': ['super_admin', 'admin'],
  'pos.manage': ['super_admin', 'admin']
};
const GROUP_AREA = {
  any: 'dashboard.view',
  content: 'content.view',
  admin: 'settings.view',
  hr: 'grh.view',
  pos: 'pos.view',
  super: null
};
const ROLE_LIST = ['super_admin', 'admin', 'editor', 'viewer', 'cashier'];
const permEnabled = (role, area) => {
  if (role === 'super_admin') return true;
  if (!area) return true;
  const row = db.prepare('SELECT enabled FROM role_permissions WHERE role = ? AND area = ?').get(role, area);
  if (row) return row.enabled === 1;
  const parent = permParent(area);
  if (!parent) return false;
  const legacy = db.prepare('SELECT enabled FROM role_permissions WHERE role = ? AND area = ?').get(role, parent);
  if (!legacy) return false;
  const allow = PERM_RESTRICT[area];
  if (allow && !allow.includes(role)) return false;
  return legacy.enabled === 1;
};
const seedFinePerms = () => {
  const exists = db.prepare('SELECT 1 AS n FROM role_permissions WHERE role = ? AND area = ?');
  const legacy = db.prepare('SELECT enabled FROM role_permissions WHERE role = ? AND area = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role, area, enabled) VALUES (?, ?, ?)');
  for (const role of ROLE_LIST) {
    for (const area of PERM_AREAS) {
      if (exists.get(role, area.id)) continue;
      const parent = permParent(area.id);
      const prev = parent ? legacy.get(role, parent) : null;
      let on = prev ? prev.enabled : 0;
      const allow = PERM_RESTRICT[area.id];
      if (allow && !allow.includes(role)) on = 0;
      ins.run(role, area.id, on);
    }
  }
};
seedFinePerms();
const requirePerm = (area) => (req, res, next) => {
  if (!permEnabled(req.user?.role, area))
    return res.status(403).json({ error: 'Accès refusé : permission non accordée à votre rôle' });
  next();
};
const requireRole = (group) => (req, res, next) => {
  const area = GROUP_AREA[group];
  const inGroup = ROLES[group]?.includes(req.user?.role);
  // Hors groupe : accès possible uniquement si la matrice du super admin l'accorde
  if (!inGroup && !(area && permEnabled(req.user.role, area)))
    return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
  // Dans le groupe : la matrice peut retirer le droit
  if (inGroup && area && !permEnabled(req.user.role, area))
    return res.status(403).json({ error: 'Accès refusé : permission non accordée à votre rôle (paramétrage du super admin)' });
  next();
};
// Garde d'un module optionnel (activé/désactivé par le super admin)
const requireModule = (name, label) => (req, res, next) => {
  if (getSetting(name) !== '1')
    return res.status(403).json({ error: `Module ${label} désactivé par le super administrateur.` });
  next();
};

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';

const uniqueSlug = (table, desired, ignoreId = null) => {
  const base = slugify(desired);
  let slug = base;
  let i = 1;
  const check = ignoreId
    ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`)
    : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  while ((ignoreId ? check.get(slug, ignoreId) : check.get(slug))) slug = `${base}-${++i}`;
  return slug;
};

const isPdfFile = (file) => {
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || name.endsWith('.pdf');
};

const isAllowedImage = (file) => {
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  if (/^image\/(jpe?g|pjpeg|png|x-png|webp|gif|avif|svg\+xml)$/.test(mime)) return true;
  return /\.(jpe?g|png|webp|gif|avif|svg)$/.test(name);
};

const isAllowedUpload = (file) => isAllowedImage(file) || isPdfFile(file);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isAllowedImage(file)) cb(null, true);
    else cb(new Error('Format non supporté (jpg, png, webp, gif, svg)'));
  }
});
// NB: le montage statique /uploads est fait plus bas, APRÈS la route protégée
// /uploads/chat/:file (les fichiers de messagerie ne sont jamais publics).

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const em = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(em);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logSecurity('login_fail', req.ip, em);
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, jti: crypto.randomBytes(12).toString('hex') }, JWT_SECRET, { expiresIn: '12h' });
  logSecurity('login_ok', req.ip, user.email);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    revokedTokens.set(tokenHash(token), (req.user?.exp || 0) * 1000);
    logSecurity('logout', req.ip, req.user?.email || '');
  }
  res.json({ ok: true });
});

app.post('/api/auth/password', authRequired, (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next || next.length < 8)
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current, user.password_hash))
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), user.id);
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(publicUser(user));
});

app.put('/api/auth/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  try {
    applyUserFields(user, req.body, { allowRole: false });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)));
});

app.get('/api/public/member/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE unique_code = ?').get(code);
  if (!user) return res.status(404).json({ error: 'Membre introuvable' });
  const u = publicUser(user);
  res.json({
    full_name: u.full_name,
    photo: u.photo,
    phone: u.phone,
    job_title: u.job_title,
    unique_code: u.unique_code,
    bio: u.bio,
    role_label: user.role === 'super_admin' ? '' : u.role_label,
    email: u.email
  });
});

app.get('/api/public/member/:code/qr', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const user = db.prepare('SELECT unique_code FROM users WHERE unique_code = ?').get(code);
  if (!user) return res.status(404).json({ error: 'Membre introuvable' });
  try {
    const url = `${requestBase(req)}/membre/${encodeURIComponent(code)}`;
    const png = await QRCode.toBuffer(url, {
      type: 'png',
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F3A88', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch {
    res.status(500).json({ error: 'Impossible de générer le QR code' });
  }
});

app.get('/api/public/site', (req, res) => res.json(publicSite()));

app.get('/api/public/modules', (req, res) => {
  res.json({
    grh_enabled: getSetting('grh_enabled') === '1',
    pos_enabled: getSetting('pos_enabled') === '1',
    maintenance_enabled: getSetting('maintenance_enabled') === '1',
    maintenance_message: getSetting('maintenance_message') || ''
  });
});

// Mode maintenance : bloque le contenu public (admin + auth + site/modules restent accessibles)
app.use((req, res, next) => {
  if (getSetting('maintenance_enabled') !== '1') return next();
  const p = req.path || '';
  if (
    p.startsWith('/api/admin') ||
    p.startsWith('/api/auth') ||
    p.startsWith('/api/register') ||
    p === '/api/public/site' ||
    p === '/api/public/modules' ||
    p.startsWith('/uploads') ||
    !p.startsWith('/api/')
  ) {
    return next();
  }
  return res.status(503).json({
    error: 'Site en maintenance',
    maintenance: true,
    message: getSetting('maintenance_message') || ''
  });
});

app.get('/api/public/articles', (req, res) => {
  const { category, limit } = req.query;
  let sql = 'SELECT * FROM articles WHERE published = 1';
  const params = [];
  if (category && category !== 'tous') { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY date DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/public/articles/:slug', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!article) return res.status(404).json({ error: 'Article introuvable' });
  res.json(article);
});

app.get('/api/public/causes', (req, res) => {
  res.json(db.prepare('SELECT * FROM causes WHERE published = 1 ORDER BY sort_order').all());
});

app.get('/api/public/causes/:slug', (req, res) => {
  const cause = db.prepare('SELECT * FROM causes WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!cause) return res.status(404).json({ error: 'Cause introuvable' });
  res.json(cause);
});

app.get('/api/public/campaigns', (req, res) => {
  res.json(db.prepare('SELECT * FROM campaigns WHERE published = 1 ORDER BY deadline').all());
});

app.get('/api/public/campaigns/:slug', (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Collecte introuvable' });
  res.json(c);
});

app.get('/api/public/partners', (req, res) => {
  res.json(db.prepare('SELECT * FROM partners WHERE published = 1 ORDER BY sort_order, id').all());
});

const siteBaseUrl = (req) =>
  (process.env.BASE_URL || `${req.protocol}://${req.headers.host}`).replace(/\/+$/, '');
const xmlEsc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const isoDate = (d) => (d ? String(d).slice(0, 10) : new Date().toISOString().slice(0, 10));

app.get('/sitemap.xml', (req, res) => {
  const base = siteBaseUrl(req);
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    { loc: base, lastmod: today },
    { loc: `${base}/a-propos`, lastmod: today },
    { loc: `${base}/notre-travail`, lastmod: today },
    { loc: `${base}/actualites`, lastmod: today },
    { loc: `${base}/collectes`, lastmod: today },
    { loc: `${base}/faire-un-don`, lastmod: today },
    { loc: `${base}/contact`, lastmod: today }
  ];
  db.prepare('SELECT slug, date FROM articles WHERE published = 1 AND (seo_noindex IS NULL OR seo_noindex = 0) ORDER BY date DESC')
    .all()
    .forEach((a) => entries.push({ loc: `${base}/actualites/${a.slug}`, lastmod: isoDate(a.date) }));
  db.prepare('SELECT slug FROM causes WHERE published = 1').all()
    .forEach((c) => entries.push({ loc: `${base}/notre-travail/${c.slug}`, lastmod: today }));
  db.prepare('SELECT slug FROM campaigns WHERE published = 1').all()
    .forEach((c) => entries.push({ loc: `${base}/collectes/${c.slug}`, lastmod: today }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map((e) => `  <url><loc>${xmlEsc(e.loc)}</loc><lastmod>${xmlEsc(e.lastmod)}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(body);
});

app.get('/robots.txt', (req, res) => {
  const base = siteBaseUrl(req);
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nDisallow: /inscription\n\nSitemap: ${base}/sitemap.xml\n`);
});

app.get('/security.txt', (req, res) => {
  const base = siteBaseUrl(req);
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(`Contact: ${getSetting('email') || 'contact@adiong.org'}\nExpires: 2027-03-31T00:00:00.000Z\nPreferred-Languages: fr\nPolicy: Report via email; include the URL and a description of the issue. We aim to respond within 72h.\n`);
});

app.get('/rss.xml', (req, res) => {
  const base = siteBaseUrl(req);
  const site = publicSite();
  const arts = db.prepare(
    'SELECT * FROM articles WHERE published = 1 AND (seo_noindex IS NULL OR seo_noindex = 0) ORDER BY date DESC LIMIT 25'
  ).all();
  const og = site.og_image ? `${base}${site.og_image}` : base;
  const items = arts.map((a) => {
    const link = `${base}/actualites/${a.slug}`;
    const desc = xmlEsc(a.seo_description || a.excerpt || '');
    const img = a.seo_image || a.image;
    return `    <item>
      <title>${xmlEsc(a.seo_title || a.title)}</title>
      <link>${xmlEsc(link)}</link>
      <guid isPermaLink="true">${xmlEsc(link)}</guid>
      <description>${desc}${img ? `<![CDATA[<img src="${base}${img}" />]]>` : ''}</description>
      <category>${xmlEsc(a.category)}</category>
      <author>${xmlEsc(a.author)}</author>
      <pubDate>${new Date(isoDate(a.date) + 'T12:00:00Z').toUTCString()}</pubDate>
    </item>`;
  }).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xmlEsc(site.site_name || 'ADI ONG')}</title>
    <link>${xmlEsc(base)}</link>
    <description>${xmlEsc(site.seo_description || site.site_tagline || '')}</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEsc(base)}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(body);
});

const clip = (v, max) => String(v ?? '').slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));
// Anti-spam : honeypot (champ invisible, rempli par les bots) + piège temporel
// (un formulaire rempli en moins de 3 s est considéré comme un bot).
// Réponse "ok" silencieuse pour ne pas révéler le piège.
const isSpam = (b) => !!(b.website) || (b.opened_at && Date.now() - Number(b.opened_at) < 3000);

app.post('/api/contact', contactLimiter, (req, res) => {
  const b = req.body || {};
  if (isSpam(b)) return res.json({ ok: true });
  const name = clip(b.name, 100).trim();
  const email = clip(b.email, 120).trim();
  const subject = clip(b.subject, 200).trim();
  const message = clip(b.message, 2000).trim();
  if (!name || !email || !message) return res.status(400).json({ error: 'Nom, email et message sont requis' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Adresse email invalide' });
  db.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)').run(name, email, subject, message);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  notifyEmail(
    `Nouveau message de ${name}${subject ? ` — ${subject}` : ''}`,
    `<p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt; a envoyé un message${subject ? ` : <strong>${esc(subject)}</strong>` : ''}.</p>
     <blockquote style="border-left:3px solid #0f3a88;margin:12px 0;padding:4px 14px;color:#333">${esc(message)}</blockquote>
     <p style="color:#888;font-size:12px">Répondre à : ${esc(email)}</p>`
  );
  res.json({ ok: true });
});

const DONATE_METHODS = { airtel: 'Airtel Money', mpesa: 'M-Pesa', orange: 'Orange Money', carte: 'Carte / virement' };
const DONATE_STATUSES = ['nouvelle', 'preuve', 'confirmee', 'refusee'];

/** Montant collecté d’une campagne = somme des dons confirmés (jamais de chiffre fictif). */
function syncCampaignCollected(campaignId) {
  if (!campaignId) return;
  const t = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS t FROM donations WHERE campaign_id = ? AND status = 'confirmee'`
  ).get(Number(campaignId)).t;
  db.prepare('UPDATE campaigns SET collected_amount = ? WHERE id = ?').run(t, Number(campaignId));
}

function syncAllCampaignCollected() {
  for (const row of db.prepare('SELECT id FROM campaigns').all()) syncCampaignCollected(row.id);
}
syncAllCampaignCollected();

const newDonationReference = () => {
  for (let i = 0; i < 5; i++) {
    const ref = `DON-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (!db.prepare('SELECT id FROM donations WHERE reference = ?').get(ref)) return ref;
  }
  return `DON-${Date.now().toString(36).toUpperCase()}`;
};

const donationPayNumber = (method) =>
  method === 'airtel' ? getSetting('pay_airtel') : method === 'mpesa' ? getSetting('pay_mpesa') : method === 'orange' ? getSetting('pay_orange') : '';

app.post('/api/donate', donateLimiter, (req, res) => {
  const b = req.body || {};
  if (isSpam(b)) return res.json({ ok: true });
  const anonymous = b.anonymous === true || b.anonymous === '1' || b.anonymous === 'true';
  const name = anonymous ? '' : clip(b.name, 100).trim();
  const email = clip(b.email, 120).trim();
  const amount = Number(b.amount);
  const message = clip(b.message, 500).trim();
  const campaignId = b.campaignId ? Number(b.campaignId) : null;
  const method = DONATE_METHODS[b.method] ? b.method : '';
  if (!anonymous && !name) return res.status(400).json({ error: 'Nom requis (ou don anonyme)' });
  if (!amount || amount <= 0 || amount > 1000000) return res.status(400).json({ error: 'Montant requis' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Adresse email invalide' });
  const reference = newDonationReference();
  const displayName = anonymous ? 'Donateur anonyme' : name;
  const currency = getSetting('currency') || 'USD';
  db.prepare(`INSERT INTO donations (campaign_id, donor_name, donor_email, amount, message, reference, method, is_anonymous, currency)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(campaignId || null, displayName, email || '', Number(amount), message || '', reference, method, anonymous ? 1 : 0, currency);
  // Le montant collecté de la campagne n’évolue qu’à la confirmation admin (syncCampaignCollected).
  const campaignTitle = campaignId
    ? (db.prepare('SELECT title FROM campaigns WHERE id = ?').get(campaignId)?.title || '')
    : '';
  const esc = (s) => String(s ?? '').replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const methodLabel = method ? ` — ${DONATE_METHODS[method]}` : '';
  notifyEmail(
    `Nouveau don de ${displayName} — ${Number(amount).toLocaleString('fr-FR')} ${currency}${campaignTitle ? ` (${campaignTitle})` : ''}`,
    `<p><strong>${esc(displayName)}</strong>${email ? ` &lt;${esc(email)}&gt;` : ''} a fait un don de <strong>${Number(amount).toLocaleString('fr-FR')} ${esc(currency)}</strong>${methodLabel}
     ${campaignTitle ? `pour la collecte <strong>${esc(campaignTitle)}</strong>` : 'de soutien'}.${message ? `<br/><em>« ${esc(message)} »</em>` : ''}</p>
     <p><strong>Référence du don : ${esc(reference)}</strong> — l'administrateur vérifiera le paiement (preuve éventuelle) dans l'espace admin → Dons.</p>`
  );
  res.json({ ok: true, reference });
});

// QR code de paiement : récapitulatif scannable (référence, moyen, numéro, montant)
app.get('/api/public/donations/qr', async (req, res) => {
  const ref = clip(req.query.ref, 24).trim().toUpperCase();
  const d = db.prepare('SELECT * FROM donations WHERE reference = ?').get(ref);
  if (!d) return res.status(404).json({ error: 'Référence inconnue' });
  const lines = [
    `DON — ${getSetting('site_name') || 'ADI ONG'}`,
    `Reference : ${d.reference}`,
    `Moyen : ${DONATE_METHODS[d.method] || 'A définir'}`,
    `Montant : ${Number(d.amount).toLocaleString('fr-FR')} ${d.currency || 'USD'}`
  ];
  const number = donationPayNumber(d.method);
  if (number) lines.splice(3, 0, `Numero : ${number}`);
  const card = getSetting('pay_card');
  if (d.method === 'carte' && card) lines.splice(3, 0, `Carte : ${card.split('\n').join(' / ')}`);
  try {
    const buf = await QRCode.toBuffer(lines.join('\n'), { width: 512, margin: 2, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch {
    res.status(500).json({ error: 'Impossible de générer le QR code' });
  }
});

// Preuves de paiement (captures d'écran) — stockées hors du site public
const proofDir = path.join(__dirname, 'data', 'donation-proofs');
fs.mkdirSync(proofDir, { recursive: true });
const proofLimiter = rateLimit({ windowMs: 60 * 60_000, max: 30, key: (req) => `proof:${req.ip}`, message: 'Trop d’envois de preuve. Réessayez dans une heure.' });
const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, proofDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 5);
      const safeExt = /\.(jpe?g|png|webp|gif|pdf)$/.test(ext) ? ext : '.bin';
      cb(null, `proof-${Date.now()}-${Math.floor(Math.random() * 1e6)}${safeExt}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/donations/proof', proofLimiter, proofUpload.single('file'), (req, res) => {
  const ref = clip(req.body?.reference, 24).trim().toUpperCase();
  const d = db.prepare('SELECT * FROM donations WHERE reference = ?').get(ref);
  if (!d) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Référence de don inconnue' });
  }
  if (d.status === 'confirmee') {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(409).json({ error: 'Ce don est déjà confirmé' });
  }
  if (!req.file) return res.status(400).json({ error: 'Fichier de preuve requis' });
  if (d.proof && fs.existsSync(d.proof)) fs.unlink(d.proof, () => {});
  const txRef = clip(req.body?.tx_ref, 60).trim();
  db.prepare('UPDATE donations SET proof = ?, proof_name = ?, tx_ref = ?, status = ? WHERE id = ?')
    .run(req.file.path, req.file.originalname || 'preuve', txRef, 'preuve', d.id);
  res.json({ ok: true, status: 'preuve', reference: d.reference });
});

app.get('/api/admin/dashboard', authRequired, requirePerm('dashboard.view'), (req, res) => {
  const q = (s) => db.prepare(s).get();
  const confirmed = q(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS t FROM donations WHERE status = 'confirmee'`);
  const pending = q(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS t FROM donations WHERE status IN ('nouvelle', 'preuve')`);

  const fillDays = (rows, days = 14) => {
    const map = new Map((rows || []).map((r) => [String(r.day).slice(0, 10), r]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = map.get(key);
      out.push({
        day: key,
        n: Number(row?.n || 0),
        total: Number(row?.total || 0)
      });
    }
    return out;
  };

  const donationsSeries = fillDays(
    db.prepare(`
      SELECT date(created_at) AS day, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total
      FROM donations
      WHERE date(created_at) >= date('now', '-13 days')
      GROUP BY date(created_at)
    `).all(),
    14
  );
  const messagesSeries = fillDays(
    db.prepare(`
      SELECT date(created_at) AS day, COUNT(*) AS n, 0 AS total
      FROM messages
      WHERE date(created_at) >= date('now', '-13 days')
      GROUP BY date(created_at)
    `).all(),
    14
  );

  const donationsByStatus = db.prepare(`
    SELECT status, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total
    FROM donations
    GROUP BY status
  `).all();

  const donationsByMethod = db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(method), ''), 'autre') AS method,
           COUNT(*) AS n,
           COALESCE(SUM(amount), 0) AS total
    FROM donations
    WHERE status = 'confirmee'
    GROUP BY COALESCE(NULLIF(TRIM(method), ''), 'autre')
    ORDER BY total DESC
  `).all();

  const campaignsProgress = db.prepare(`
    SELECT id, slug, title, goal_amount, collected_amount, deadline
    FROM campaigns
    WHERE published = 1
    ORDER BY CASE WHEN goal_amount > 0 THEN collected_amount * 1.0 / goal_amount ELSE 0 END DESC
    LIMIT 6
  `).all();

  const articlesByCategory = db.prepare(`
    SELECT category, COUNT(*) AS n
    FROM articles
    WHERE published = 1
    GROUP BY category
    ORDER BY n DESC
  `).all();

  res.json({
    articles: q('SELECT COUNT(*) AS n FROM articles WHERE published = 1').n,
    articles_drafts: q('SELECT COUNT(*) AS n FROM articles WHERE published = 0').n,
    causes: q('SELECT COUNT(*) AS n FROM causes WHERE published = 1').n,
    campaigns: q('SELECT COUNT(*) AS n FROM campaigns WHERE published = 1').n,
    donations: q('SELECT COUNT(*) AS n FROM donations').n,
    donations_confirmed: confirmed.n,
    donations_pending: pending.n,
    donations_total: confirmed.t,
    donations_pending_total: pending.t,
    campaigns_collected: confirmed.t,
    messages: q('SELECT COUNT(*) AS n FROM messages').n,
    unread_messages: q('SELECT COUNT(*) AS n FROM messages WHERE read = 0').n,
    donations_series: donationsSeries,
    messages_series: messagesSeries,
    donations_by_status: donationsByStatus,
    donations_by_method: donationsByMethod,
    campaigns_progress: campaignsProgress,
    articles_by_category: articlesByCategory,
    latest_messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5').all(),
    latest_donations: db.prepare('SELECT d.*, c.title AS campaign_title FROM donations d LEFT JOIN campaigns c ON c.id = d.campaign_id ORDER BY d.created_at DESC LIMIT 5').all()
  });
});

app.get('/api/admin/article-categories', authRequired, requirePerm('content.view'), (req, res) => {
  res.json(db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM articles a WHERE a.category = c.slug) AS articles
    FROM article_categories c
    ORDER BY c.sort_order, c.name
  `).all());
});

app.post('/api/admin/article-categories', authRequired, requirePerm('content.create'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom de la catégorie requis' });
  const slug = uniqueSlug('article_categories', req.body?.slug || name);
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM article_categories').get().n;
  const info = db.prepare('INSERT INTO article_categories (slug, name, sort_order) VALUES (?, ?, ?)').run(
    slug, name, Number(req.body?.sort_order) || max + 10
  );
  res.json(db.prepare('SELECT * FROM article_categories WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/article-categories/:id', authRequired, requirePerm('content.edit'), (req, res) => {
  const ex = db.prepare('SELECT * FROM article_categories WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Catégorie introuvable' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom de la catégorie requis' });
  const slug = uniqueSlug('article_categories', req.body?.slug || name, Number(ex.id));
  const sort = req.body?.sort_order == null ? ex.sort_order : Number(req.body.sort_order) || 0;
  db.prepare('UPDATE article_categories SET name = ?, slug = ?, sort_order = ? WHERE id = ?').run(name, slug, sort, ex.id);
  if (slug !== ex.slug) {
    db.prepare('UPDATE articles SET category = ? WHERE category = ?').run(slug, ex.slug);
  }
  res.json(db.prepare('SELECT * FROM article_categories WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/article-categories/:id', authRequired, requirePerm('content.delete'), (req, res) => {
  const ex = db.prepare('SELECT * FROM article_categories WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Catégorie introuvable' });
  const used = db.prepare('SELECT COUNT(*) n FROM articles WHERE category = ?').get(ex.slug).n;
  if (used > 0) return res.status(409).json({ error: `Impossible : ${used} article(s) dans cette catégorie.` });
  db.prepare('DELETE FROM article_categories WHERE id = ?').run(ex.id);
  res.json({ ok: true });
});

app.get('/api/admin/articles', authRequired, requirePerm('content.view'), (req, res) => res.json(db.prepare('SELECT * FROM articles ORDER BY date DESC').all()));
app.post('/api/admin/articles', authRequired, requirePerm('content.create'), (req, res) => {
  const { title, slug, excerpt, content, category, image, author, date, published,
    seo_title, seo_description, seo_image, seo_noindex } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const s = uniqueSlug('articles', slug || title);
  const info = db.prepare(`INSERT INTO articles (slug, title, excerpt, content, category, image, author, date, published, seo_title, seo_description, seo_image, seo_noindex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(s, title, excerpt || '', content || '', category || 'actualites', image || '', author || 'ADI ONG',
      date || new Date().toISOString().slice(0, 10), published ? 1 : 0,
      seo_title || '', seo_description || '', seo_image || '', seo_noindex ? 1 : 0);
  res.json(db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/admin/articles/:id', authRequired, requirePerm('content.edit'), (req, res) => {
  const { title, slug, excerpt, content, category, image, author, date, published,
    seo_title, seo_description, seo_image, seo_noindex } = req.body || {};
  db.prepare(`UPDATE articles SET title=?, slug=?, excerpt=?, content=?, category=?, image=?, author=?, date=?, published=?, seo_title=?, seo_description=?, seo_image=?, seo_noindex=? WHERE id=?`)
    .run(title, uniqueSlug('articles', slug || 'article', Number(req.params.id)), excerpt || '', content || '', category || 'actualites', image || '', author || 'ADI ONG',
      date || new Date().toISOString().slice(0, 10), published ? 1 : 0,
      seo_title || '', seo_description || '', seo_image || '', seo_noindex ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id));
});
app.delete('/api/admin/articles/:id', authRequired, requirePerm('content.delete'), (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/causes', authRequired, requirePerm('content.view'), (req, res) => res.json(db.prepare('SELECT * FROM causes ORDER BY sort_order').all()));
app.post('/api/admin/causes', authRequired, requirePerm('content.create'), (req, res) => {
  const { title, slug, tagline, description, long_content, icon, image, link, sort_order } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const s = uniqueSlug('causes', slug || title);
  const info = db.prepare(`INSERT INTO causes (slug, title, tagline, description, long_content, icon, image, link, sort_order, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(s, title, tagline || '', description || '', long_content || '', icon || 'megaphone', image || '', link || '', sort_order || 99);
  res.json(db.prepare('SELECT * FROM causes WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/admin/causes/:id', authRequired, requirePerm('content.edit'), (req, res) => {
  const { title, slug, tagline, description, long_content, icon, image, link, sort_order, published } = req.body || {};
  db.prepare(`UPDATE causes SET title=?, slug=?, tagline=?, description=?, long_content=?, icon=?, image=?, link=?, sort_order=?, published=? WHERE id=?`)
    .run(title, uniqueSlug('causes', slug || 'cause', Number(req.params.id)), tagline || '', description || '', long_content || '', icon || 'megaphone', image || '', link || '', Number(sort_order || 99), published ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM causes WHERE id = ?').get(req.params.id));
});
app.delete('/api/admin/causes/:id', authRequired, requirePerm('content.delete'), (req, res) => {
  db.prepare('DELETE FROM causes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/campaigns', authRequired, requirePerm('content.view'), (req, res) => res.json(db.prepare('SELECT * FROM campaigns ORDER BY deadline').all()));
app.post('/api/admin/campaigns', authRequired, requirePerm('content.create'), (req, res) => {
  const { title, slug, description, image, goal_amount, deadline, cause_slug } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const s = uniqueSlug('campaigns', slug || title);
  const info = db.prepare(`INSERT INTO campaigns (slug, title, description, image, goal_amount, collected_amount, deadline, cause_slug, published)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)`)
    .run(s, title, description || '', image || '', Number(goal_amount) || 0, deadline || '', cause_slug || '');
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/admin/campaigns/:id', authRequired, requirePerm('content.edit'), (req, res) => {
  const { title, slug, description, image, goal_amount, deadline, cause_slug, published } = req.body || {};
  const id = Number(req.params.id);
  db.prepare(`UPDATE campaigns SET title=?, slug=?, description=?, image=?, goal_amount=?, deadline=?, cause_slug=?, published=? WHERE id=?`)
    .run(title, uniqueSlug('campaigns', slug || 'collecte', id), description || '', image || '', Number(goal_amount) || 0, deadline || '', cause_slug || '', published ? 1 : 0, id);
  syncCampaignCollected(id);
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id));
});
app.delete('/api/admin/campaigns/:id', authRequired, requirePerm('content.delete'), (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Partenaires (bandeau de logos au-dessus du footer)
app.get('/api/admin/partners', authRequired, requirePerm('content.view'), (req, res) =>
  res.json(db.prepare('SELECT * FROM partners ORDER BY sort_order, id').all()));

app.post('/api/admin/partners', authRequired, requirePerm('content.create'), (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim() || !String(b.logo || '').trim())
    return res.status(400).json({ error: 'Nom et logo du partenaire sont requis' });
  try {
    const info = db.prepare('INSERT INTO partners (name, logo, link, sort_order, published) VALUES (?, ?, ?, ?, ?)')
      .run(String(b.name).trim(), b.logo, b.link || '', Number(b.sort_order) || 0, b.published === false ? 0 : 1);
    res.json(db.prepare('SELECT * FROM partners WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    console.error('[partners]', e);
    res.status(500).json({ error: 'Impossible d’enregistrer le partenaire' });
  }
});

app.put('/api/admin/partners/:id', authRequired, requirePerm('content.edit'), (req, res) => {
  const ex = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Partenaire introuvable' });
  const b = { ...ex, ...req.body };
  db.prepare('UPDATE partners SET name = ?, logo = ?, link = ?, sort_order = ?, published = ? WHERE id = ?')
    .run(String(b.name).trim(), b.logo, b.link || '', Number(b.sort_order) || 0, b.published ? 1 : 0, ex.id);
  res.json(db.prepare('SELECT * FROM partners WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/partners/:id', authRequired, requirePerm('content.delete'), (req, res) => {
  db.prepare('DELETE FROM partners WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/donations', authRequired, requirePerm('donations.view'), (req, res) =>
  res.json(db.prepare('SELECT d.*, c.title AS campaign_title FROM donations d LEFT JOIN campaigns c ON c.id = d.campaign_id ORDER BY d.created_at DESC').all()));
app.put('/api/admin/donations/:id', authRequired, requirePerm('donations.edit'), (req, res) => {
  const prev = db.prepare('SELECT * FROM donations WHERE id = ?').get(req.params.id);
  if (!prev) return res.status(404).json({ error: 'Don introuvable' });
  const status = DONATE_STATUSES.includes(req.body?.status) ? req.body.status : 'nouvelle';
  db.prepare('UPDATE donations SET status = ? WHERE id = ?').run(status, req.params.id);
  syncCampaignCollected(prev.campaign_id);
  res.json(db.prepare('SELECT d.*, c.title AS campaign_title FROM donations d LEFT JOIN campaigns c ON c.id = d.campaign_id WHERE d.id = ?').get(req.params.id));
});
app.get('/api/admin/donations/:id/proof', authRequired, requirePerm('donations.view'), (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE id = ?').get(req.params.id);
  if (!d || !d.proof || !fs.existsSync(d.proof)) return res.status(404).json({ error: 'Preuve introuvable' });
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.proof_name || 'preuve')}"`);
  res.sendFile(d.proof);
});
app.delete('/api/admin/donations/:id', authRequired, requirePerm('donations.delete'), (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE id = ?').get(req.params.id);
  if (d?.proof && fs.existsSync(d.proof)) fs.unlink(d.proof, () => {});
  db.prepare('DELETE FROM donations WHERE id = ?').run(req.params.id);
  syncCampaignCollected(d?.campaign_id);
  res.json({ ok: true });
});

app.get('/api/admin/messages', authRequired, requirePerm('inbox.view'), (req, res) => res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()));
app.put('/api/admin/messages/:id', authRequired, requirePerm('inbox.edit'), (req, res) => {
  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/messages/:id', authRequired, requirePerm('inbox.delete'), (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/settings', authRequired, requirePerm('settings.view'), (req, res) => {
  const s = publicSite();
  s.stats = JSON.parse(JSON.stringify(s.stats));
  s.values = JSON.parse(JSON.stringify(s.values));
  s.method = JSON.parse(JSON.stringify(s.method));
  res.json(s);
});
const SETTING_KEYS = new Set([...STRING_SETTINGS, ...Object.keys(JSON_SETTINGS)]);
app.put('/api/admin/settings', authRequired, requirePerm('settings.write'), (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!SETTING_KEYS.has(k)) continue;
    const value = typeof v === 'string' ? v : JSON.stringify(v);
    setSetting(k, value);
  }
  res.json(publicSite());
});

app.post('/api/admin/upload', authRequired, requirePerm('media.upload'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image fournie' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

const mediaDir = path.join(uploadDir, 'media');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
const docsDir = path.join(uploadDir, 'docs');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isAllowedUpload(file)) cb(null, true);
    else cb(new Error('Format non supporté (jpg, png, webp, gif, svg, pdf)'));
  }
});

function uniqueMediaFilename(original) {
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const raw = path.basename(String(original || 'image')).replace(/[^\w.\-+() ]+/g, '_').slice(0, 160) || 'image';
  const ext = path.extname(raw) || '.jpg';
  const stem = path.basename(raw, ext).slice(0, 120) || 'image';
  const candidate = `${stem}-${stamp}${ext}`;
  if (!db.prepare('SELECT 1 FROM media WHERE filename = ?').get(candidate)) return candidate;
  return `${stem}-${stamp}-${crypto.randomBytes(2).toString('hex')}${ext}`;
}

function scaleTo(image, maxW, maxH) {
  const { width, height } = image.bitmap;
  const scale = Math.min(maxW / width, maxH / height, 1);
  if (scale >= 1) return { w: width, h: height };
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  image.resize(w, h, Jimp.RESIZE_BICUBIC);
  return { w, h };
}

function isPdfMedia(row) {
  return /pdf/i.test(row.mime || '') || /\.pdf$/i.test(row.url || '') || /\.pdf$/i.test(row.filename || '');
}

function storeRawMedia(buffer, originalName, folder) {
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const origExt = path.extname(originalName).toLowerCase() || (folder === 'docs' ? '.pdf' : '.png');
  const allowed = /^\.(jpe?g|png|webp|gif|avif|svg|pdf)$/i.test(origExt);
  const ext = allowed ? origExt : (folder === 'docs' ? '.pdf' : '.png');
  const dir = folder === 'docs' ? docsDir : mediaDir;
  const mainName = `${stamp}${ext}`;
  fs.writeFileSync(path.join(dir, mainName), buffer);
  return { folder, mainName, thumbName: mainName, width: 0, height: 0, size: buffer.length };
}

function opaqueBounds(image) {
  const { width, height, data } = image.bitmap;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(width * y + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  const pad = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x,
    y,
    w: Math.min(width - x, maxX - minX + 1 + pad * 2),
    h: Math.min(height - y, maxY - minY + 1 + pad * 2)
  };
}

async function storeTrimmedPng(buffer) {
  try {
    const image = await Jimp.read(buffer);
    const box = opaqueBounds(image);
    const area = image.bitmap.width * image.bitmap.height;
    if (box && (box.w * box.h) / area < 0.92) {
      image.crop(box.x, box.y, box.w, box.h);
    }
    scaleTo(image, 1200, 800);
    const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const mainName = `${stamp}.png`;
    const mainPath = path.join(mediaDir, mainName);
    await image.writeAsync(mainPath);
    return {
      folder: 'media',
      mainName,
      thumbName: mainName,
      width: image.bitmap.width,
      height: image.bitmap.height,
      size: fs.statSync(mainPath).size
    };
  } catch {
    return null;
  }
}

async function optimizeBuffer(buffer, originalName = 'image.jpg') {
  const origExt = path.extname(originalName).toLowerCase() || '.jpg';
  const looksPdf = origExt === '.pdf' || buffer.slice(0, 5).toString() === '%PDF-';
  if (looksPdf) return storeRawMedia(buffer, originalName, 'docs');
  if (['.svg', '.gif', '.avif'].includes(origExt)) return storeRawMedia(buffer, originalName, 'media');
  if (origExt === '.png' && buffer.length <= 2 * 1024 * 1024) {
    return (await storeTrimmedPng(buffer)) || storeRawMedia(buffer, originalName, 'media');
  }
  try {
    const image = await Jimp.read(buffer);
    const keepPng = origExt === '.png';
    const mainExt = keepPng ? 'png' : 'jpg';
    const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    scaleTo(image, 1600, 1600);
    image.quality(82);
    const mainPath = path.join(mediaDir, `${stamp}.${mainExt}`);
    await image.writeAsync(mainPath);

    if (buffer.length > 0 && buffer.length < fs.statSync(mainPath).size && origExt === `.${mainExt}`) {
      fs.writeFileSync(mainPath, buffer);
    }

    const thumb = image.clone();
    scaleTo(thumb, 480, 480);
    thumb.quality(78);
    const thumbPath = path.join(mediaDir, `${stamp}.thumb.jpg`);
    await thumb.writeAsync(thumbPath);

    const size = fs.statSync(mainPath).size;
    return {
      folder: 'media',
      mainName: path.basename(mainPath),
      thumbName: path.basename(thumbPath),
      width: image.bitmap.width,
      height: image.bitmap.height,
      size
    };
  } catch {
    return storeRawMedia(buffer, originalName, 'media');
  }
}

app.post('/api/admin/media', authRequired, requirePerm('media.upload'), (req, res) => {
  memoryUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'Aucun fichier fourni' });
      const opt = await optimizeBuffer(req.file.buffer, req.file.originalname);
      const folder = opt.folder || 'media';
      const url = `/uploads/${folder}/${opt.mainName}`;
      const thumb = `/uploads/${folder}/${opt.thumbName}`;
      const alt = String(req.body?.alt || '').slice(0, 300);
      const filename = uniqueMediaFilename(req.file.originalname);
      const mime = String(req.file.mimetype || 'application/octet-stream').slice(0, 120);
      const info = db.prepare(`INSERT INTO media (filename, url, thumb, size, width, height, mime, alt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(filename, url, thumb, opt.size, opt.width, opt.height, mime, alt);
      res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid));
    } catch (e) {
      console.error('[media]', e);
      if (!res.headersSent) res.status(500).json({ error: `Échec du téléversement : ${e.message || 'erreur serveur'}` });
    }
  });
});

app.get('/api/admin/media', authRequired, requirePerm('media.view'), (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const type = String(req.query.type || '').toLowerCase();
  let rows = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
  if (type === 'pdf') rows = rows.filter(isPdfMedia);
  else if (type === 'image') rows = rows.filter((m) => !isPdfMedia(m));
  if (q) {
    rows = rows.filter((m) =>
      m.filename.toLowerCase().includes(q) || (m.alt || '').toLowerCase().includes(q)
    );
  }
  res.json(rows);
});

app.patch('/api/admin/media/:id', authRequired, requirePerm('media.upload'), (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Image introuvable' });
  const alt = String(req.body?.alt ?? (m.alt || '')).slice(0, 300);
  db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(alt, m.id);
  res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(m.id));
});

app.delete('/api/admin/media/:id', authRequired, requirePerm('media.delete'), (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Fichier introuvable' });
  const used =
    db.prepare('SELECT COUNT(*) n FROM articles WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM causes WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM campaigns WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM users WHERE photo = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM partners WHERE logo = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM grh_employees WHERE photo = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM articles WHERE content LIKE ?').get(`%${m.url}%`).n;
  const settingUsed = db.prepare('SELECT COUNT(*) n FROM settings WHERE value LIKE ?').get(`%${m.url}%`).n;
  if (used + settingUsed > 0)
    return res.status(409).json({ error: 'Ce fichier est utilisé sur le site. Remplacez-le avant de le supprimer.' });
  for (const f of [m.url, m.thumb]) {
    if (!f) continue;
    const rel = f.replace(/^\/uploads\//, '');
    try { fs.unlinkSync(path.join(uploadDir, rel)); } catch {  }
  }
  db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  res.json({ ok: true });
});

const ROLE_LABELS = { super_admin: 'Super administrateur', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Consultation' };
const PRIVILEGED = ['super_admin', 'admin'];

function actorIsSuper(req) {
  return req.user?.role === 'super_admin';
}

/** Un subalterne ne voit ni ne gère les comptes Super admin. */
function hiddenSuper(targetRole, actorRole) {
  return targetRole === 'super_admin' && actorRole !== 'super_admin';
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    role_label: ROLE_LABELS[u.role] || u.role,
    photo: u.photo || '',
    phone: u.phone || '',
    job_title: u.job_title || '',
    unique_code: u.unique_code || '',
    bio: u.bio || '',
    created_at: u.created_at
  };
}

function requestBase(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

function applyUserFields(user, body, { allowRole = false, actorRole } = {}) {
  const { full_name, email, photo, phone, job_title, bio, role, password } = body || {};
  if (typeof full_name === 'string') db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name.trim() || user.full_name, user.id);
  if (typeof email === 'string' && email.trim()) {
    const next = email.toLowerCase().trim();
    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(next, user.id);
    if (taken) throw Object.assign(new Error('Cet email est déjà utilisé'), { status: 409 });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(next, user.id);
  }
  if (typeof photo === 'string') db.prepare('UPDATE users SET photo = ? WHERE id = ?').run(photo, user.id);
  if (typeof phone === 'string') db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone.trim(), user.id);
  if (typeof job_title === 'string') db.prepare('UPDATE users SET job_title = ? WHERE id = ?').run(job_title.trim(), user.id);
  if (typeof bio === 'string') db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio.trim(), user.id);
  if (allowRole && role) {
    if (!['super_admin', 'admin', 'editor', 'viewer', 'cashier'].includes(role)) throw Object.assign(new Error('Rôle invalide'), { status: 400 });
    if (role === 'super_admin' && actorRole !== 'super_admin')
      throw Object.assign(new Error('Seul un super administrateur peut accorder ce rôle'), { status: 403 });
    const err = guardLastAdmin(user.id, role);
    if (err) throw Object.assign(new Error(err), { status: 409 });
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  }
  if (password) {
    if (password.length < 8) throw Object.assign(new Error('Mot de passe : 8 caractères minimum'), { status: 400 });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id);
  }
}

function guardLastAdmin(id, role) {
  const currentPriv = db.prepare('SELECT COUNT(*) n FROM users WHERE role IN (?, ?)').get('super_admin', 'admin').n;
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (PRIVILEGED.includes(target?.role) && !PRIVILEGED.includes(role) && currentPriv <= 1)
    return 'Impossible : il doit rester au moins un compte administrateur/super administrateur';
  return null;
}

app.get('/api/admin/security', authRequired, requirePerm('security.view'), (req, res) => {
  let rows = db.prepare('SELECT * FROM security_events ORDER BY id DESC LIMIT 100').all();
  if (!actorIsSuper(req)) {
    const hidden = new Set(
      db.prepare("SELECT email FROM users WHERE role = 'super_admin'").all()
        .map((r) => String(r.email || '').toLowerCase())
    );
    rows = rows.filter((e) => !hidden.has(String(e.email || '').toLowerCase()));
  }
  res.json(rows);
});

app.get('/api/admin/users', authRequired, requirePerm('users.view'), (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all()
    .filter((u) => !hiddenSuper(u.role, req.user.role));
  res.json(users.map(publicUser));
});

app.post('/api/admin/users', authRequired, requirePerm('users.create'), (req, res) => {
  const { email, password, full_name, role, photo, phone, job_title, bio } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  if (!['super_admin', 'admin', 'editor', 'viewer', 'cashier'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (role === 'super_admin' && req.user.role !== 'super_admin')
    return res.status(403).json({ error: 'Seul un super administrateur peut créer un super administrateur' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, full_name, role, photo, phone, job_title, unique_code, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    String(email).toLowerCase().trim(),
    bcrypt.hashSync(password, 10),
    (full_name || '').trim() || email,
    role,
    photo || '',
    (phone || '').trim(),
    (job_title || '').trim(),
    newUniqueCode(),
    (bio || '').trim()
  );
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/admin/users/:id', authRequired, requirePerm('users.edit'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user || hiddenSuper(user.role, req.user.role)) return res.status(404).json({ error: 'Utilisateur introuvable' });
  try {
    applyUserFields(user, req.body, { allowRole: true, actorRole: req.user.role });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)));
});

app.post('/api/admin/users/:id/code', authRequired, requirePerm('users.edit'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user || hiddenSuper(user.role, req.user.role)) return res.status(404).json({ error: 'Utilisateur introuvable' });
  db.prepare('UPDATE users SET unique_code = ? WHERE id = ?').run(newUniqueCode(), user.id);
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)));
});

app.delete('/api/admin/users/:id', authRequired, requirePerm('users.delete'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user || hiddenSuper(user.role, req.user.role)) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (Number(req.params.id) === req.user.id) return res.status(409).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  const err = guardLastAdmin(user.id, 'viewer');
  if (err) return res.status(409).json({ error: err });
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

// ---------- Modules (super admin) ----------
app.get('/api/admin/modules', authRequired, (req, res) => {
  res.json({
    grh_enabled: getSetting('grh_enabled') === '1',
    pos_enabled: getSetting('pos_enabled') === '1',
    chat_enabled: getSetting('chat_enabled') !== '0',
    maintenance_enabled: getSetting('maintenance_enabled') === '1',
    maintenance_message: getSetting('maintenance_message') || '',
    is_super: req.user.role === 'super_admin'
  });
});

app.put('/api/admin/modules', authRequired, requirePerm('modules.manage'), (req, res) => {
  const { grh_enabled, pos_enabled, chat_enabled, maintenance_enabled, maintenance_message } = req.body || {};
  if (typeof grh_enabled === 'boolean') setSetting('grh_enabled', grh_enabled ? '1' : '0');
  if (typeof pos_enabled === 'boolean') setSetting('pos_enabled', pos_enabled ? '1' : '0');
  if (typeof chat_enabled === 'boolean') setSetting('chat_enabled', chat_enabled ? '1' : '0');
  if (typeof maintenance_enabled === 'boolean') setSetting('maintenance_enabled', maintenance_enabled ? '1' : '0');
  if (typeof maintenance_message === 'string') {
    setSetting('maintenance_message', maintenance_message.trim().slice(0, 500));
  }
  res.json({
    grh_enabled: getSetting('grh_enabled') === '1',
    pos_enabled: getSetting('pos_enabled') === '1',
    chat_enabled: getSetting('chat_enabled') !== '0',
    maintenance_enabled: getSetting('maintenance_enabled') === '1',
    maintenance_message: getSetting('maintenance_message') || '',
    is_super: true
  });
});

// ---------- Permissions : matrice rôles × zones (configurable par le super admin) ----------
app.get('/api/admin/permissions', authRequired, (req, res) => {
  const canManage = req.user.role === 'super_admin' || permEnabled(req.user.role, 'roles.manage');
  const roles = (canManage ? ROLE_LIST : ROLE_LIST.filter((r) => r === req.user.role))
    .filter((r) => r !== 'super_admin' || actorIsSuper(req));
  res.json({
    groups: PERM_GROUPS,
    areas: PERM_AREAS,
    matrix: roles.map((role) => ({
      role,
      locked: role === 'super_admin',
      permissions: PERM_AREAS.map((a) => ({ area: a.id, enabled: permEnabled(role, a.id) }))
    })),
    is_super: canManage
  });
});

app.put('/api/admin/permissions', authRequired, requirePerm('roles.manage'), (req, res) => {
  const m = req.body?.matrix;
  if (!m || typeof m !== 'object') return res.status(400).json({ error: 'Permission(s) invalide(s)' });
  const stmt = db.prepare('INSERT INTO role_permissions (role, area, enabled) VALUES (?, ?, ?) ON CONFLICT(role, area) DO UPDATE SET enabled = excluded.enabled');
  let changed = 0;
  for (const [role, areas] of Object.entries(m)) {
    if (role === 'super_admin') return res.status(400).json({ error: 'Le super administrateur conserve toujours tous les droits' });
    if (!ROLES.any.includes(role)) return res.status(400).json({ error: `Rôle inconnu : ${role}` });
    if (!areas || typeof areas !== 'object') continue;
    for (const [area, on] of Object.entries(areas)) {
      if (!PERM_AREAS.some((a) => a.id === area)) return res.status(400).json({ error: `Zone inconnue : ${area}` });
      stmt.run(role, area, on ? 1 : 0);
      changed++;
    }
  }
  res.json({ ok: true, changed });
});

// ---------- GRH (rôles admin+super, module activable) ----------
const grhAction = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (String(req.path).includes('/attendance')) return requirePerm('grh.attendance')(req, res, next);
  return requirePerm('grh.manage')(req, res, next);
};
const GRH = [authRequired, requirePerm('grh.view'), requireModule('grh_enabled', 'GRH'), grhAction];

// Comptage des jours ouvrés (lun–ven, bornes incluses)
const businessDays = (startISO, endISO) => {
  if (!startISO) return 0;
  const s = new Date(String(startISO).slice(0, 10) + 'T00:00:00Z');
  const e = endISO ? new Date(String(endISO).slice(0, 10) + 'T00:00:00Z') : s;
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  let n = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n += 1;
  }
  return n;
};
const globalAnnualDays = () => Number(getSetting('grh_annual_leave_days') || 22) || 22;
const leaveBalance = (employeeId) => {
  const emp = db.prepare('SELECT annual_days FROM grh_employees WHERE id = ?').get(employeeId);
  if (!emp) return { annual: 0, used: 0, remaining: 0 };
  const annual = Number(emp.annual_days) || globalAnnualDays();
  const year = String(new Date().getUTCFullYear());
  const used = db.prepare(
    "SELECT COALESCE(SUM(days), 0) s FROM grh_leaves WHERE employee_id = ? AND status = 'approuve' AND type = 'conge' AND strftime('%Y', start_date) = ?"
  ).get(employeeId, year).s;
  return { annual, used, remaining: annual - used };
};
const annualLeaveAllowed = (employeeId, days, excludeLeaveId = null) => {
  const bal = leaveBalance(employeeId);
  let used = bal.used;
  if (excludeLeaveId) {
    const self = db.prepare("SELECT days FROM grh_leaves WHERE id = ? AND type = 'conge' AND status = 'approuve'").get(excludeLeaveId);
    if (self) used = Math.max(0, used - self.days);
  }
  return used + days <= bal.annual;
};

app.get('/api/admin/grh/overview', ...GRH, (req, res) => {
  const q = (s, ...p) => { try { return db.prepare(s).get(...p); } catch { return { n: 0 }; } };
  const all = (s, ...p) => { try { return db.prepare(s).all(...p); } catch { return []; } };
  const active = q("SELECT COUNT(*) n FROM grh_employees WHERE status = 'actif'").n;
  const total = q('SELECT COUNT(*) n FROM grh_employees').n;
  const inactive = Math.max(0, total - active);
  const leavesPending = q("SELECT COUNT(*) n FROM grh_leaves WHERE status = 'en_attente'").n;
  const today = new Date().toISOString().slice(0, 10);
  const leavesOngoing = q(
    "SELECT COUNT(*) n FROM grh_leaves WHERE status = 'approuve' AND start_date <= ? AND (end_date = '' OR end_date >= ?)",
    today, today
  ).n;
  const byDept = all(`
    SELECT COALESCE(d.name, 'Non affecté') AS name, COUNT(e.id) AS n
    FROM grh_employees e LEFT JOIN grh_departments d ON d.id = e.department_id
    WHERE e.status = 'actif' GROUP BY d.name ORDER BY n DESC
  `);
  const byContract = all(`
    SELECT COALESCE(NULLIF(TRIM(contract_type), ''), 'permanent') AS type, COUNT(*) AS n
    FROM grh_employees WHERE status = 'actif' GROUP BY type ORDER BY n DESC
  `);
  const leavesByType = all(`
    SELECT type, COUNT(*) AS n
    FROM grh_leaves
    WHERE status = 'approuve' AND start_date >= date('now', 'start of year')
    GROUP BY type ORDER BY n DESC
  `);
  const hireRows = all(`
    SELECT substr(hire_date, 1, 7) AS month, COUNT(*) AS n
    FROM grh_employees
    WHERE hire_date != '' AND hire_date >= date('now', '-11 months', 'start of month')
    GROUP BY month
  `);
  const hireMap = new Map(hireRows.map((r) => [String(r.month).slice(0, 7), Number(r.n || 0)]));
  const hiresSeries = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    hiresSeries.push({ month: key, n: hireMap.get(key) || 0 });
  }
  const recentHires = all(
    "SELECT id, full_name, position, hire_date, photo FROM grh_employees WHERE status = 'actif' AND hire_date != '' ORDER BY hire_date DESC LIMIT 5"
  );
  const upcomingLeaves = all(`
    SELECT l.type, l.start_date, l.end_date, e.full_name
    FROM grh_leaves l JOIN grh_employees e ON e.id = l.employee_id
    WHERE l.status = 'approuve' AND l.start_date >= ? ORDER BY l.start_date LIMIT 5
  `, today);
  res.json({
    active,
    total,
    inactive,
    leavesPending,
    leavesOngoing,
    byDept,
    byContract,
    leavesByType,
    hires_series: hiresSeries,
    presentToday: q("SELECT COUNT(*) n FROM grh_attendance WHERE date = date('now') AND clock_in != ''").n,
    tasksOpen: q("SELECT COUNT(*) n FROM grh_tasks WHERE status != 'terminee'").n,
    projectsActive: q("SELECT COUNT(*) n FROM grh_projects WHERE status = 'en_cours'").n,
    candidatesOpen: q("SELECT COUNT(*) n FROM grh_candidates WHERE stage IN ('recu', 'entretien')").n,
    recentHires,
    upcomingLeaves
  });
});

// Départements
app.get('/api/admin/grh/departments', ...GRH, (req, res) => {
  res.json(
    db.prepare(`
      SELECT d.*, COUNT(e.id) AS employees
      FROM grh_departments d LEFT JOIN grh_employees e ON e.department_id = d.id AND e.status = 'actif'
      GROUP BY d.id ORDER BY d.name
    `).all()
  );
});

app.post('/api/admin/grh/departments', ...GRH, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom du département requis' });
  try {
    const info = db.prepare('INSERT INTO grh_departments (name) VALUES (?)').run(name);
    res.json(db.prepare('SELECT * FROM grh_departments WHERE id = ?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Ce département existe déjà' });
  }
});

app.put('/api/admin/grh/departments/:id', ...GRH, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom du département requis' });
  try {
    db.prepare('UPDATE grh_departments SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json(db.prepare('SELECT * FROM grh_departments WHERE id = ?').get(req.params.id));
  } catch {
    res.status(409).json({ error: 'Ce département existe déjà' });
  }
});

app.delete('/api/admin/grh/departments/:id', ...GRH, (req, res) => {
  const used = db.prepare('SELECT COUNT(*) n FROM grh_employees WHERE department_id = ?').get(req.params.id).n;
  if (used > 0) return res.status(409).json({ error: `Impossible : ${used} employé(s) affecté(s) à ce département.` });
  db.prepare('DELETE FROM grh_departments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Employés
app.get('/api/admin/grh/employees', ...GRH, (req, res) => {
  const { q, department, status } = req.query;
  let sql = `
    SELECT e.*, d.name AS department, m.full_name AS manager_name
    FROM grh_employees e
    LEFT JOIN grh_departments d ON d.id = e.department_id
    LEFT JOIN grh_employees m ON m.id = e.manager_id
  `;
  const where = [];
  const params = [];
  if (q) {
    where.push('(e.full_name LIKE ? OR e.email LIKE ? OR e.position LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (department) { where.push('e.department_id = ?'); params.push(department); }
  if (status) { where.push('e.status = ?'); params.push(status); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY e.full_name';
  const rows = db.prepare(sql).all(...params);
  rows.forEach((r) => { r.balance = leaveBalance(r.id); });
  if (req.user.role !== 'super_admin') rows.forEach((r) => { r.salary = null; });
  res.json(rows);
});

app.post('/api/admin/grh/employees', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!String(b.full_name || '').trim()) return res.status(400).json({ error: 'Nom de l\'employé requis' });
  const salary = req.user.role === 'super_admin' ? (b.salary === '' || b.salary == null ? null : Number(b.salary) || null) : null;
  try {
    const info = db.prepare(`INSERT INTO grh_employees
      (full_name, email, phone, position, department_id, contract_type, hire_date, status, leave_date, salary, salary_currency, photo, notes, manager_id, annual_days, job_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      String(b.full_name).trim(), b.email || null, b.phone || '', b.position || '',
      b.department_id || null, b.contract_type || 'permanent', b.hire_date || '',
      b.status || 'actif', b.leave_date || '', salary, b.salary_currency || 'USD',
      b.photo || '', b.notes || '',
      b.manager_id || null, Math.max(0, Number(b.annual_days) || 0), String(b.job_description || '').slice(0, 4000)
    );
    res.json(db.prepare('SELECT * FROM grh_employees WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    console.error('[grh employees create]', e);
    if (String(e.message || '').includes('UNIQUE'))
      return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre employé' });
    res.status(500).json({ error: e.message || 'Impossible de créer l\'employé' });
  }
});

app.put('/api/admin/grh/employees/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_employees WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Employé introuvable' });
  const b = { ...ex, ...req.body };
  const salary = req.user.role === 'super_admin' ? (b.salary === '' || b.salary == null ? null : Number(b.salary) || null) : ex.salary;
  const managerId = Number(b.manager_id) === ex.id ? null : (b.manager_id || null);
  try {
    db.prepare(`UPDATE grh_employees SET
      full_name = ?, email = ?, phone = ?, position = ?, department_id = ?, contract_type = ?,
      hire_date = ?, status = ?, leave_date = ?, salary = ?, salary_currency = ?, photo = ?, notes = ?,
      manager_id = ?, annual_days = ?, job_description = ?
      WHERE id = ?`).run(
      String(b.full_name).trim(), b.email || null, b.phone || '', b.position || '',
      b.department_id || null, b.contract_type || 'permanent', b.hire_date || '',
      b.status || 'actif', b.leave_date || '', salary, b.salary_currency || 'USD',
      b.photo || '', b.notes || '',
      managerId, Math.max(0, Number(b.annual_days) || 0), String(b.job_description || '').slice(0, 4000), ex.id
    );
    if (req.user.role === 'super_admin' && salary !== ex.salary && (salary != null || ex.salary != null)) {
      db.prepare('INSERT INTO grh_salary_history (employee_id, old_salary, new_salary) VALUES (?, ?, ?)')
        .run(ex.id, ex.salary, salary ?? 0);
    }
    res.json(db.prepare('SELECT * FROM grh_employees WHERE id = ?').get(ex.id));
  } catch (e) {
    console.error('[grh employees update]', e);
    if (String(e.message || '').includes('UNIQUE'))
      return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre employé' });
    res.status(500).json({ error: e.message || 'Impossible de mettre à jour l\'employé' });
  }
});

app.delete('/api/admin/grh/employees/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_leaves WHERE employee_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_evaluations WHERE employee_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_training_attendees WHERE employee_id = ?').run(req.params.id);
  const docs = db.prepare('SELECT * FROM grh_documents WHERE employee_id = ?').all(req.params.id);
  docs.forEach((d) => safeUnlink(path.join(empDocsDir, d.file)));
  db.prepare('DELETE FROM grh_documents WHERE employee_id = ?').run(req.params.id);
  db.prepare('UPDATE grh_employees SET manager_id = NULL WHERE manager_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_employees WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Détail employé : fiche + solde + documents + congés
app.get('/api/admin/grh/employees/:id', ...GRH, (req, res) => {
  const row = db.prepare(`
    SELECT e.*, d.name AS department, m.full_name AS manager_name
    FROM grh_employees e
    LEFT JOIN grh_departments d ON d.id = e.department_id
    LEFT JOIN grh_employees m ON m.id = e.manager_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Employé introuvable' });
  row.balance = leaveBalance(row.id);
  if (req.user.role !== 'super_admin') row.salary = null;
  row.documents = db.prepare('SELECT * FROM grh_documents WHERE employee_id = ? ORDER BY created_at DESC').all(row.id);
  row.leaves = db.prepare('SELECT * FROM grh_leaves WHERE employee_id = ? ORDER BY start_date DESC LIMIT 20').all(row.id);
  row.salary_history = req.user.role === 'super_admin'
    ? db.prepare('SELECT * FROM grh_salary_history WHERE employee_id = ? ORDER BY id DESC LIMIT 20').all(row.id)
    : [];
  res.json(row);
});

// Documents du dossier (privés : accès HR uniquement, jamais servis publiquement)
const empDocsDir = path.join(__dirname, 'data', 'employee-docs');
if (!fs.existsSync(empDocsDir)) fs.mkdirSync(empDocsDir, { recursive: true });

const docsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, empDocsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = isAllowedUpload(file) ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ok) cb(null, true);
    else cb(new Error('Format non supporté (image, PDF, Word)'));
  }
});
app.post('/api/admin/grh/employees/:id/documents', ...GRH, docsUpload.single('file'), (req, res) => {
  const emp = db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const info = db.prepare('INSERT INTO grh_documents (employee_id, name, file, category) VALUES (?, ?, ?, ?)').run(
    emp.id,
    String(req.body?.name || req.file.originalname || 'Document').slice(0, 200),
    req.file.filename,
    String(req.body?.category || 'autre').slice(0, 40)
  );
  res.json(db.prepare('SELECT * FROM grh_documents WHERE id = ?').get(info.lastInsertRowid));
});
app.get('/api/admin/grh/documents/:id', ...GRH, (req, res) => {
  const doc = db.prepare('SELECT * FROM grh_documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  const full = path.join(empDocsDir, doc.file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Fichier manquant' });
  res.download(full, doc.name);
});
app.delete('/api/admin/grh/documents/:id', ...GRH, (req, res) => {
  const doc = db.prepare('SELECT * FROM grh_documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  safeUnlink(path.join(empDocsDir, doc.file));
  db.prepare('DELETE FROM grh_documents WHERE id = ?').run(doc.id);
  res.json({ ok: true });
});

// Organigramme (arborescence par supérieur hiérarchique)
app.get('/api/admin/grh/orgchart', ...GRH, (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.full_name, e.position, e.photo, e.status, e.department_id, e.manager_id, d.name AS department
    FROM grh_employees e LEFT JOIN grh_departments d ON d.id = e.department_id
  `).all();
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    const parent = r.manager_id ? byId.get(r.manager_id) : null;
    if (parent && parent.id !== r.id) parent.children.push(node);
    else roots.push(node);
  }
  const order = (list) => list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'));
  const walk = (list) => { order(list); list.forEach((n) => walk(n.children)); };
  walk(roots);
  res.json(roots);
});

// Congés
app.get('/api/admin/grh/leaves', ...GRH, (req, res) => {
  const { status, employee_id, month } = req.query;
  let sql = `
    SELECT l.*, e.full_name AS employee_name, e.position AS employee_position
    FROM grh_leaves l JOIN grh_employees e ON e.id = l.employee_id
  `;
  const where = [];
  const params = [];
  if (status) { where.push('l.status = ?'); params.push(status); }
  if (employee_id) { where.push('l.employee_id = ?'); params.push(employee_id); }
  if (month) {
    where.push('l.start_date <= ? AND (l.end_date = \'\' OR l.end_date >= ?)');
    params.push(`${month}-31`, `${month}-01`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.start_date DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/admin/grh/leaves', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!b.employee_id || !b.start_date) return res.status(400).json({ error: 'Employé et date de début requis' });
  if (!db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(b.employee_id))
    return res.status(404).json({ error: 'Employé introuvable' });
  const type = ['conge', 'maladie', 'maternite', 'sans_solde', 'formation'].includes(b.type) ? b.type : 'conge';
  const status = ['en_attente', 'approuve', 'rejette'].includes(b.status) ? b.status : 'en_attente';
  const days = businessDays(b.start_date, b.end_date || b.start_date);
  if (!days) return res.status(400).json({ error: 'Dates de congé invalides' });
  if (type === 'conge' && status === 'approuve' && !annualLeaveAllowed(b.employee_id, days))
    return res.status(400).json({ error: 'Solde de congés annuel insuffisant pour cette demande.' });
  const info = db.prepare(
    'INSERT INTO grh_leaves (employee_id, type, start_date, end_date, reason, status, days) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(b.employee_id, type, b.start_date, b.end_date || '', String(b.reason || '').slice(0, 500), status, days);
  res.json(db.prepare('SELECT * FROM grh_leaves WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/grh/leaves/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_leaves WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Congé introuvable' });
  const b = { ...ex, ...req.body };
  b.type = ['conge', 'maladie', 'maternite', 'sans_solde', 'formation'].includes(b.type) ? b.type : ex.type;
  b.status = ['en_attente', 'approuve', 'rejette'].includes(b.status) ? b.status : ex.status;
  const days = businessDays(b.start_date, b.end_date || b.start_date) || ex.days || 1;
  if (b.type === 'conge' && b.status === 'approuve' && !annualLeaveAllowed(b.employee_id, days, ex.id))
    return res.status(400).json({ error: 'Solde de congés annuel insuffisant pour cette demande.' });
  db.prepare(
    'UPDATE grh_leaves SET employee_id = ?, type = ?, start_date = ?, end_date = ?, reason = ?, status = ?, days = ? WHERE id = ?'
  ).run(b.employee_id, b.type, b.start_date, b.end_date || '', String(b.reason || '').slice(0, 500), b.status, days, ex.id);
  res.json(db.prepare('SELECT * FROM grh_leaves WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/grh/leaves/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_leaves WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Présences : pointage automatique (début/fin depuis l'activité dans « Mon espace ») ----------
const ATTENDANCE_SQL = `
  SELECT a.*, e.full_name AS employee_name, e.position AS employee_position, e.status AS employee_status
  FROM grh_attendance a
  JOIN grh_employees e ON e.id = a.employee_id
`;
const parseHm = (v) => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v).padStart(5, '0') : null;

app.get('/api/admin/grh/attendance', ...GRH, (req, res) => {
  const { month, employee_id, q } = req.query;
  let sql = ATTENDANCE_SQL;
  const where = [];
  const params = [];
  if (month && /^\d{4}-\d{2}$/.test(month)) { where.push('a.date >= ? AND a.date < ?'); params.push(`${month}-01`, `${month}-${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) , 1)).toISOString().slice(0, 7)}`); }
  else { const today = orgParts().date; where.push('a.date >= ?'); params.push(today.slice(0, 8) + '01'); }
  if (employee_id) { where.push('a.employee_id = ?'); params.push(employee_id); }
  if (q) { where.push('e.full_name LIKE ?'); params.push(`%${q}%`); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY a.date DESC, e.full_name';
  res.json(db.prepare(sql).all(...params));
});

app.put('/api/admin/grh/attendance/:id', ...GRH, (req, res) => {
  const a = db.prepare('SELECT * FROM grh_attendance WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Pointage introuvable' });
  const b = req.body || {};
  let date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? String(b.date) : a.date;
  let clockIn = a.clock_in, clockOut = a.clock_out, corrected = a.corrected;
  if (date !== a.date) {
    clockIn = clockIn ? `${date} ${String(clockIn).slice(11, 19)}` : clockIn;
    clockOut = clockOut ? `${date} ${String(clockOut).slice(11, 19)}` : clockOut;
  }
  if (b.clock_in !== undefined || b.clock_out !== undefined) {
    const inT = parseHm(b.clock_in);
    const outT = b.clock_out === '' || b.clock_out == null ? null : parseHm(b.clock_out);
    if (!inT) return res.status(400).json({ error: 'Heure de début invalide (format HH:MM)' });
    if (outT && outT <= inT) return res.status(400).json({ error: 'L’heure de fin doit être postérieure à l’heure de début' });
    clockIn = wallHmToUtc(date, inT);
    clockOut = outT ? wallHmToUtc(date, outT) : (a.clock_out || wallHmToUtc(date, inT));
    corrected = 1;
  }
  const dup = db.prepare('SELECT id FROM grh_attendance WHERE employee_id = ? AND date = ? AND id != ?').get(a.employee_id, date, a.id);
  if (dup) return res.status(409).json({ error: 'Cet employé a déjà un pointage pour cette date' });
  db.prepare('UPDATE grh_attendance SET date = ?, clock_in = ?, clock_out = ?, corrected = ? WHERE id = ?')
    .run(date, clockIn, clockOut, corrected, a.id);
  res.json(db.prepare(`${ATTENDANCE_SQL} WHERE a.id = ?`).get(a.id));
});

app.delete('/api/admin/grh/attendance/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_attendance WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/grh/attendance/export', ...GRH, (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : orgParts().date.slice(0, 7);
  const end = `${month}-${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)).toISOString().slice(0, 7)}`;
  const rows = db.prepare(`${ATTENDANCE_SQL} WHERE a.date >= ? AND a.date < ? ORDER BY a.date, e.full_name`).all(`${month}-01`, end);
  const dur = (a) => {
    const s = new Date(String(a.clock_in || a.last_seen).replace(' ', 'T') + 'Z').getTime();
    const e = new Date(String(a.clock_out || a.last_seen).replace(' ', 'T') + 'Z').getTime();
    const m = Math.max(0, Math.round((e - s) / 60000));
    return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  };
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['Date;Employé;Fonction;Début;Fin;Durée;Corrigé'];
  rows.forEach((r) => lines.push([r.date, r.employee_name, r.employee_position || '', utcStampToHm(r.clock_in), utcStampToHm(r.clock_out || r.last_seen), dur(r), r.corrected ? 'Oui' : 'Non'].map(esc).join(';')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="presences-${month}.csv"`);
  res.send('\uFEFF' + lines.join('\n'));
});

// ---------- Paie (super admin uniquement : les salaires sont confidentiels) ----------
const PAY = [authRequired, requirePerm('grh.payroll'), requireModule('grh_enabled', 'GRH')];
const validMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
const monthLabelFr = (m) => {
  const [y, mo] = String(m).split('-');
  return new Date(Date.UTC(Number(y), Number(mo) - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fmtMoney = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/[\u202f\u00a0\u2009]/g, ' ');

app.get('/api/admin/grh/payroll', ...PAY, (req, res) => {
  const month = String(req.query.month || '');
  if (!validMonth(month)) return res.status(400).json({ error: 'Mois invalide (format AAAA-MM)' });
  res.json(db.prepare(`
    SELECT p.*, e.full_name, e.position, e.email, e.hire_date, e.salary AS current_salary, d.name AS department
    FROM grh_payroll p
    JOIN grh_employees e ON e.id = p.employee_id
    LEFT JOIN grh_departments d ON d.id = e.department_id
    WHERE p.month = ?
    ORDER BY e.full_name
  `).all(month));
});

app.post('/api/admin/grh/payroll', ...PAY, (req, res) => {
  const b = req.body || {};
  const month = String(b.month || '');
  if (!validMonth(month)) return res.status(400).json({ error: 'Mois invalide (format AAAA-MM)' });
  const emp = db.prepare('SELECT * FROM grh_employees WHERE id = ?').get(b.employee_id);
  if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
  const base = Number(b.base_salary) || Number(emp.salary) || 0;
  const bonus = Math.max(0, Number(b.bonus) || 0);
  const deductions = Math.max(0, Number(b.deductions) || 0);
  const status = ['brouillon', 'envoye'].includes(b.status) ? b.status : 'brouillon';
  try {
    const info = db.prepare(`INSERT INTO grh_payroll
      (employee_id, month, base_salary, bonus, bonus_label, deductions, deductions_label, net, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      emp.id, month, base, bonus, String(b.bonus_label || '').slice(0, 200),
      deductions, String(b.deductions_label || '').slice(0, 200),
      base + bonus - deductions, b.currency || emp.salary_currency || 'USD', status
    );
    res.json(db.prepare('SELECT * FROM grh_payroll WHERE id = ?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Un bulletin existe déjà pour cet employé ce mois-ci — modifiez-le.' });
  }
});

app.put('/api/admin/grh/payroll/:id', ...PAY, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_payroll WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Bulletin introuvable' });
  const b = { ...ex, ...req.body };
  if (!validMonth(b.month)) return res.status(400).json({ error: 'Mois invalide (format AAAA-MM)' });
  const bonus = Math.max(0, Number(b.bonus) || 0);
  const deductions = Math.max(0, Number(b.deductions) || 0);
  const base = Number(b.base_salary) || 0;
  const status = ['brouillon', 'envoye'].includes(b.status) ? b.status : ex.status;
  try {
    db.prepare(`UPDATE grh_payroll SET employee_id = ?, month = ?, base_salary = ?, bonus = ?, bonus_label = ?,
      deductions = ?, deductions_label = ?, net = ?, currency = ?, status = ? WHERE id = ?`).run(
      b.employee_id, b.month, base, bonus, String(b.bonus_label || '').slice(0, 200),
      deductions, String(b.deductions_label || '').slice(0, 200), base + bonus - deductions,
      b.currency || ex.currency, status, ex.id
    );
    res.json(db.prepare('SELECT * FROM grh_payroll WHERE id = ?').get(ex.id));
  } catch {
    res.status(409).json({ error: 'Un bulletin existe déjà pour cet employé ce mois-ci.' });
  }
});

app.delete('/api/admin/grh/payroll/:id', ...PAY, (req, res) => {
  db.prepare('DELETE FROM grh_payroll WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Génère les brouillons du mois pour tous les actifs ayant un salaire
app.post('/api/admin/grh/payroll/generate', ...PAY, (req, res) => {
  const month = String(req.body?.month || '');
  if (!validMonth(month)) return res.status(400).json({ error: 'Mois invalide (format AAAA-MM)' });
  const emps = db.prepare("SELECT * FROM grh_employees WHERE status = 'actif' AND salary IS NOT NULL AND salary > 0").all();
  let created = 0, skipped = 0;
  const ins = db.prepare('INSERT OR IGNORE INTO grh_payroll (employee_id, month, base_salary, net, currency) VALUES (?, ?, ?, ?, ?)');
  for (const e of emps) {
    const r = ins.run(e.id, month, Number(e.salary), Number(e.salary), e.salary_currency || 'USD');
    if (r.changes) created++; else skipped++;
  }
  res.json({ created, skipped, total: emps.length });
});

// Export CSV (séparateur ; + BOM pour Excel)
app.get('/api/admin/grh/payroll/export', ...PAY, (req, res) => {
  const month = String(req.query.month || '');
  if (!validMonth(month)) return res.status(400).json({ error: 'Mois invalide (format AAAA-MM)' });
  const rows = db.prepare(`
    SELECT e.full_name, e.position, COALESCE(d.name, '') AS dept, p.month, p.base_salary, p.bonus, p.bonus_label,
           p.deductions, p.deductions_label, p.net, p.currency, p.status
    FROM grh_payroll p
    JOIN grh_employees e ON e.id = p.employee_id
    LEFT JOIN grh_departments d ON d.id = e.department_id
    WHERE p.month = ?
    ORDER BY e.full_name
  `).all(month);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['Employé;Fonction;Département;Mois;Salaire de base;Primes;Détail primes;Retenues;Détail retenues;Net à payer;Devise;Statut'];
  rows.forEach((r) => lines.push(
    [r.full_name, r.position, r.dept, monthLabelFr(r.month), r.base_salary, r.bonus, r.bonus_label,
     r.deductions, r.deductions_label, r.net, r.currency, r.status === 'envoye' ? 'Envoyé' : 'Brouillon']
      .map(esc).join(';')
  ));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="paie-${month}.csv"`);
  res.send('\uFEFF' + lines.join('\n'));
});

// Bulletin PDF (pdf-lib)
app.get('/api/admin/grh/payroll/:id/pdf', ...PAY, async (req, res) => {
  const p = db.prepare(`
    SELECT p.*, e.full_name, e.position, e.email, e.phone, d.name AS department, e.hire_date
    FROM grh_payroll p
    JOIN grh_employees e ON e.id = p.employee_id
    LEFT JOIN grh_departments d ON d.id = e.department_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Bulletin introuvable' });
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const W = 595.28;
    const [font, fontBold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold)
    ]);
    const brand = rgb(0.059, 0.227, 0.533);
    const ink = rgb(0.1, 0.12, 0.18);
    const gray = rgb(0.45, 0.5, 0.58);
    const siteName = getSetting('site_name') || 'ADI ONG';
    const tagline = getSetting('site_tagline') || '';

    page.drawRectangle({ x: 0, y: 841.89 - 88, width: W, height: 88, color: brand });
    page.drawText(siteName.toUpperCase(), { x: 40, y: 782, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    if (tagline) page.drawText(tagline, { x: 40, y: 764, size: 9, font, color: rgb(0.85, 0.89, 0.95) });
    page.drawText('BULLETIN DE PAIE', { x: 40, y: 728, size: 22, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(`Période : ${monthLabelFr(p.month)}`, { x: 400, y: 728, size: 11, font: fontBold, color: rgb(1, 1, 1) });

    const box = (x, y, w, h) => page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.82, 0.85, 0.9), borderWidth: 1 });
    box(40, 560, 240, 120);
    box(315, 560, 240, 120);
    page.drawText('ORGANISATION', { x: 50, y: 664, size: 8, font: fontBold, color: gray });
    page.drawText(siteName, { x: 50, y: 648, size: 10, font: fontBold, color: ink });
    const addr = getSetting('address') || '';
    const ph = getSetting('phone1') || '';
    const em = getSetting('email') || '';
    let ly = 632;
    if (addr) { page.drawText(addr, { x: 50, y: ly, size: 9, font, color: ink }); ly -= 14; }
    if (ph) { page.drawText(ph, { x: 50, y: ly, size: 9, font, color: ink }); ly -= 14; }
    if (em) { page.drawText(em, { x: 50, y: ly, size: 9, font, color: ink }); }
    page.drawText('EMPLOYÉ', { x: 325, y: 664, size: 8, font: fontBold, color: gray });
    page.drawText(p.full_name, { x: 325, y: 648, size: 10, font: fontBold, color: ink });
    ly = 632;
    if (p.position) { page.drawText(`Fonction : ${p.position}`, { x: 325, y: ly, size: 9, font, color: ink }); ly -= 14; }
    if (p.department) { page.drawText(`Département : ${p.department}`, { x: 325, y: ly, size: 9, font, color: ink }); ly -= 14; }
    if (p.hire_date) { page.drawText(`Embauché le : ${p.hire_date}`, { x: 325, y: ly, size: 9, font, color: ink }); ly -= 14; }
    if (p.email) { page.drawText(p.email, { x: 325, y: ly, size: 9, font, color: ink }); }

    // Tableau des montants
    const rows = [
      ['Salaire de base', fmtMoney(p.base_salary)],
      ...(p.bonus > 0 ? [['Primes' + (p.bonus_label ? ` — ${p.bonus_label}` : ''), `+ ${fmtMoney(p.bonus)}`]] : []),
      ...(p.deductions > 0 ? [['Retenues' + (p.deductions_label ? ` — ${p.deductions_label}` : ''), `- ${fmtMoney(p.deductions)}`]] : []),
      ['Total', fmtMoney(p.base_salary + p.bonus - (Number(p.deductions) || 0))]
    ];
    let ry = 540;
    for (const [label, val] of rows) {
      page.drawText(label, { x: 40, y: ry, size: 10, font, color: ink });
      page.drawText(val, { x: 475, y: ry, size: 10, font, color: ink });
      page.drawLine({ start: { x: 40, y: ry - 8 }, end: { x: 555, y: ry - 8 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.93) });
      ry -= 30;
    }
    page.drawRectangle({ x: 335, y: ry - 6, width: 220, height: 40, color: brand });
    page.drawText(`NET À PAYER (${p.currency})`, { x: 350, y: ry + 24, size: 10, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(fmtMoney(p.net), { x: 350, y: ry + 8, size: 15, font: fontBold, color: rgb(1, 1, 1) });

    page.drawText(`Statut : ${p.status === 'envoye' ? 'Envoyé' : 'Brouillon'}  ·  Émis le ${new Date().toLocaleDateString('fr-FR')}`, { x: 40, y: ry - 30, size: 8, font, color: gray });
    page.drawText('Signature de l’employeur', { x: 40, y: 90, size: 8, font, color: gray });
    page.drawText('Signature de l’employé', { x: 400, y: 90, size: 8, font, color: gray });
    page.drawLine({ start: { x: 40, y: 120 }, end: { x: 240, y: 120 }, thickness: 0.7, color: ink });
    page.drawLine({ start: { x: 400, y: 120 }, end: { x: 555, y: 120 }, thickness: 0.7, color: ink });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bulletin-${p.full_name.replace(/\s+/g, '-').toLowerCase()}-${p.month}.pdf"`);
    res.send(Buffer.from(await doc.save()));
  } catch (e) {
    res.status(500).json({ error: 'Impossible de générer le PDF' });
  }
});

// ---------- Recrutement : offres + candidats ----------
const cvDir = path.join(__dirname, 'data', 'cvs');
if (!fs.existsSync(cvDir)) fs.mkdirSync(cvDir, { recursive: true });
const cvUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, cvDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = isAllowedUpload(file) ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ok) cb(null, true);
    else cb(new Error('Format non supporté (PDF, Word, image)'));
  }
});
const STAGES = ['recu', 'entretien', 'retenu', 'refuse', 'retire'];

app.get('/api/admin/grh/jobs', ...GRH, (req, res) => {
  res.json(db.prepare(`
    SELECT j.*, d.name AS department,
      (SELECT COUNT(*) FROM grh_candidates c WHERE c.job_id = j.id) AS candidates
    FROM grh_jobs j LEFT JOIN grh_departments d ON d.id = j.department_id
    ORDER BY (j.deadline = ''), j.deadline, j.created_at DESC
  `).all());
});

app.post('/api/admin/grh/jobs', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Intitulé de l’offre requis' });
  const info = db.prepare(`INSERT INTO grh_jobs
    (title, department_id, description, requirements, contract_type, location, salary_min, salary_max, salary_currency, published, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    String(b.title).trim().slice(0, 200),
    b.department_id || null,
    String(b.description || '').slice(0, 8000),
    String(b.requirements || '').slice(0, 8000),
    b.contract_type || 'permanent',
    String(b.location || '').slice(0, 200),
    b.salary_min == null || b.salary_min === '' ? null : Number(b.salary_min) || null,
    b.salary_max == null || b.salary_max === '' ? null : Number(b.salary_max) || null,
    b.salary_currency || 'USD',
    b.published === false || b.published === 0 ? 0 : 1,
    b.deadline || ''
  );
  res.json(db.prepare('SELECT * FROM grh_jobs WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/grh/jobs/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_jobs WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Offre introuvable' });
  const b = { ...ex, ...req.body };
  db.prepare(`UPDATE grh_jobs SET
    title = ?, department_id = ?, description = ?, requirements = ?, contract_type = ?,
    location = ?, salary_min = ?, salary_max = ?, salary_currency = ?, published = ?, deadline = ?
    WHERE id = ?`).run(
    String(b.title).trim().slice(0, 200),
    b.department_id || null,
    String(b.description || '').slice(0, 8000),
    String(b.requirements || '').slice(0, 8000),
    b.contract_type || 'permanent',
    String(b.location || '').slice(0, 200),
    b.salary_min == null || b.salary_min === '' ? null : Number(b.salary_min) || null,
    b.salary_max == null || b.salary_max === '' ? null : Number(b.salary_max) || null,
    b.salary_currency || 'USD',
    b.published === false || b.published === 0 || b.published === '0' ? 0 : 1,
    b.deadline || '', ex.id
  );
  res.json(db.prepare('SELECT * FROM grh_jobs WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/grh/jobs/:id', ...GRH, (req, res) => {
  db.prepare('UPDATE grh_candidates SET job_id = NULL WHERE job_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/grh/candidates', ...GRH, (req, res) => {
  const { job_id, stage } = req.query;
  let sql = `
    SELECT c.*, j.title AS job_title
    FROM grh_candidates c LEFT JOIN grh_jobs j ON j.id = c.job_id
  `;
  const where = [];
  const params = [];
  if (job_id) { where.push('c.job_id = ?'); params.push(job_id); }
  if (stage) { where.push('c.stage = ?'); params.push(stage); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY c.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/admin/grh/candidates', ...GRH, cvUpload.single('cv'), (req, res) => {
  const b = req.body || {};
  if (!String(b.full_name || '').trim()) return res.status(400).json({ error: 'Nom du candidat requis' });
  const stage = STAGES.includes(b.stage) ? b.stage : 'recu';
  const cvFile = req.file ? req.file.filename : '';
  const info = db.prepare(`INSERT INTO grh_candidates
    (job_id, full_name, email, phone, stage, cv_file, interview_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    b.job_id || null,
    String(b.full_name).trim().slice(0, 200),
    String(b.email || '').trim().slice(0, 120),
    String(b.phone || '').slice(0, 40),
    stage,
    cvFile,
    b.interview_date || '',
    String(b.notes || '').slice(0, 4000)
  );
  res.json(db.prepare('SELECT * FROM grh_candidates WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/grh/candidates/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_candidates WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Candidat introuvable' });
  const b = { ...ex, ...req.body };
  db.prepare(`UPDATE grh_candidates SET
    job_id = ?, full_name = ?, email = ?, phone = ?, stage = ?, interview_date = ?, notes = ?
    WHERE id = ?`).run(
    b.job_id || null,
    String(b.full_name).trim().slice(0, 200),
    String(b.email || '').trim().slice(0, 120),
    String(b.phone || '').slice(0, 40),
    STAGES.includes(b.stage) ? b.stage : ex.stage,
    b.interview_date || '',
    String(b.notes || '').slice(0, 4000), ex.id
  );
  res.json(db.prepare('SELECT * FROM grh_candidates WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/grh/candidates/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_candidates WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Candidat introuvable' });
  if (ex.cv_file) safeUnlink(path.join(cvDir, ex.cv_file));
  db.prepare('DELETE FROM grh_candidates WHERE id = ?').run(ex.id);
  res.json({ ok: true });
});

app.get('/api/admin/grh/candidates/:id/cv', ...GRH, (req, res) => {
  const c = db.prepare('SELECT * FROM grh_candidates WHERE id = ?').get(req.params.id);
  if (!c || !c.cv_file) return res.status(404).json({ error: 'Aucun CV pour ce candidat' });
  const full = path.join(cvDir, c.cv_file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Fichier manquant' });
  res.download(full, `cv-${c.full_name.replace(/\s+/g, '-').toLowerCase()}` + path.extname(c.cv_file));
});

// Conversion candidat → employé (pipeline terminé)
app.post('/api/admin/grh/candidates/:id/hire', ...GRH, (req, res) => {
  const c = db.prepare('SELECT * FROM grh_candidates WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidat introuvable' });
  if (c.stage === 'retenu' && c.hired_at) return res.status(409).json({ error: 'Ce candidat est déjà converti en employé.' });
  if (c.email && db.prepare('SELECT id FROM grh_employees WHERE email IS NOT NULL AND lower(email) = ?').get(String(c.email).toLowerCase().trim()))
    return res.status(409).json({ error: 'Un employé avec cette adresse email existe déjà.' });
  const today = new Date().toISOString().slice(0, 10);
  const contractType = c.job_id ? (db.prepare('SELECT contract_type FROM grh_jobs WHERE id = ?').get(c.job_id)?.contract_type || 'permanent') : 'permanent';
  const deptId = c.job_id ? (db.prepare('SELECT department_id FROM grh_jobs WHERE id = ?').get(c.job_id)?.department_id || null) : null;
  try {
    const info = db.prepare(`INSERT INTO grh_employees
      (full_name, email, phone, position, department_id, contract_type, hire_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'actif')`).run(
      c.full_name,
      c.email ? String(c.email).toLowerCase().trim() : null,
      c.phone || '',
      c.job_id ? (db.prepare('SELECT title FROM grh_jobs WHERE id = ?').get(c.job_id)?.title || '') : '',
      deptId,
      contractType,
      today
    );
    db.prepare("UPDATE grh_candidates SET stage = 'retenu', hired_at = ? WHERE id = ?").run(today, c.id);
    res.json(db.prepare('SELECT * FROM grh_employees WHERE id = ?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Impossible de créer l’employé (email déjà utilisé ?)' });
  }
});

// ---------- Évaluations annuelles ----------
const EVAL_STATUSES = ['brouillon', 'validee'];
const parseEval = (r) => {
  if (!r) return r;
  try { r.criteria = JSON.parse(r.criteria || '[]'); } catch { r.criteria = []; }
  return r;
};
const cleanCriteria = (input) =>
  (Array.isArray(input) ? input : [])
    .map((c) => ({
      label: String(c?.label || '').trim().slice(0, 120),
      score: Math.min(5, Math.max(1, Number(c?.score) || 3))
    }))
    .filter((c) => c.label);

app.get('/api/admin/grh/evaluations', ...GRH, (req, res) => {
  const { employee_id } = req.query;
  let sql = `
    SELECT ev.*, e.full_name, e.position, u.full_name AS evaluated_by_name
    FROM grh_evaluations ev
    JOIN grh_employees e ON e.id = ev.employee_id
    LEFT JOIN users u ON u.id = ev.created_by
  `;
  const params = [];
  if (employee_id) { sql += ' WHERE ev.employee_id = ?'; params.push(employee_id); }
  sql += ' ORDER BY ev.period DESC, e.full_name';
  res.json(db.prepare(sql).all(...params).map(parseEval));
});

app.post('/api/admin/grh/evaluations', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!b.employee_id) return res.status(400).json({ error: 'Employé requis' });
  if (!db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(b.employee_id))
    return res.status(404).json({ error: 'Employé introuvable' });
  const period = String(b.period || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'Période requise (format AAAA-MM)' });
  const criteria = cleanCriteria(b.criteria);
  if (!criteria.length) return res.status(400).json({ error: 'Au moins un critère d’évaluation requis' });
  const status = EVAL_STATUSES.includes(b.status) ? b.status : 'brouillon';
  if (db.prepare('SELECT id FROM grh_evaluations WHERE employee_id = ? AND period = ?').get(b.employee_id, period))
    return res.status(409).json({ error: 'Une évaluation existe déjà pour cet employé sur cette période — modifiez-la.' });
  const overall = Math.round((criteria.reduce((a, c) => a + c.score, 0) / criteria.length) * 10) / 10;
  const info = db.prepare(
    'INSERT INTO grh_evaluations (employee_id, period, criteria, overall, comments, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(b.employee_id, period, JSON.stringify(criteria), overall, String(b.comments || '').slice(0, 4000), status, req.user.id);
  res.json(parseEval(db.prepare('SELECT * FROM grh_evaluations WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/admin/grh/evaluations/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_evaluations WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Évaluation introuvable' });
  const b = req.body || {};
  const employeeId = b.employee_id || ex.employee_id;
  if (!db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(employeeId))
    return res.status(404).json({ error: 'Employé introuvable' });
  const period = String(b.period ?? ex.period).slice(0, 7);
  const criteria = Array.isArray(b.criteria)
    ? cleanCriteria(b.criteria)
    : (() => { try { return JSON.parse(ex.criteria || '[]'); } catch { return []; } })();
  if (!criteria.length) return res.status(400).json({ error: 'Au moins un critère d’évaluation requis' });
  const status = EVAL_STATUSES.includes(b.status) ? b.status : ex.status;
  const dup = db.prepare('SELECT id FROM grh_evaluations WHERE employee_id = ? AND period = ? AND id != ?').get(employeeId, period, ex.id);
  if (dup) return res.status(409).json({ error: 'Une évaluation existe déjà pour cet employé sur cette période.' });
  const overall = Math.round((criteria.reduce((a, c) => a + c.score, 0) / criteria.length) * 10) / 10;
  db.prepare('UPDATE grh_evaluations SET employee_id = ?, period = ?, criteria = ?, overall = ?, comments = ?, status = ? WHERE id = ?')
    .run(employeeId, period, JSON.stringify(criteria), overall, String(b.comments ?? ex.comments ?? '').slice(0, 4000), status, ex.id);
  res.json(parseEval(db.prepare('SELECT * FROM grh_evaluations WHERE id = ?').get(ex.id)));
});

app.delete('/api/admin/grh/evaluations/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_evaluations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Formations ----------
const TRAIN_TYPES = ['interne', 'externe'];
const TRAIN_STATUSES = ['inscrit', 'termine', 'annule'];
const fetchTraining = (id) => {
  const t = db.prepare('SELECT * FROM grh_trainings WHERE id = ?').get(id);
  if (!t) return t;
  t.attendees = db.prepare(`
    SELECT ta.id, ta.employee_id, ta.status, ta.completed_at, e.full_name, e.position
    FROM grh_training_attendees ta JOIN grh_employees e ON e.id = ta.employee_id
    WHERE ta.training_id = ? ORDER BY e.full_name
  `).all(id).map((a) => ({ id: a.id, employee_id: a.employee_id, full_name: a.full_name, position: a.position, status: a.status, completed_at: a.completed_at }));
  return t;
};
const enrollAttendees = (trainingId, ids) => {
  const ins = db.prepare('INSERT OR IGNORE INTO grh_training_attendees (training_id, employee_id) VALUES (?, ?)');
  for (const eid of Array.isArray(ids) ? ids : []) {
    if (db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(eid)) ins.run(trainingId, eid);
  }
};

app.get('/api/admin/grh/trainings', ...GRH, (req, res) => {
  const rows = db.prepare("SELECT * FROM grh_trainings ORDER BY (start_date = ''), start_date DESC, id DESC").all();
  res.json(rows.map((t) => fetchTraining(t.id)));
});

app.post('/api/admin/grh/trainings', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Intitulé de la formation requis' });
  const info = db.prepare(`INSERT INTO grh_trainings (title, type, provider, start_date, end_date, cost, cost_currency, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    String(b.title).trim().slice(0, 200),
    TRAIN_TYPES.includes(b.type) ? b.type : 'externe',
    String(b.provider || '').trim().slice(0, 200),
    b.start_date || '',
    b.end_date || '',
    b.cost === '' || b.cost == null ? null : Number(b.cost) || null,
    b.cost_currency || 'USD',
    String(b.notes || '').slice(0, 2000)
  );
  const t = db.prepare('SELECT * FROM grh_trainings WHERE id = ?').get(info.lastInsertRowid);
  enrollAttendees(t.id, b.employee_ids);
  res.json(fetchTraining(t.id));
});

app.put('/api/admin/grh/trainings/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_trainings WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Formation introuvable' });
  const b = req.body || {};
  const merged = { ...ex, ...b };
  db.prepare(`UPDATE grh_trainings SET title = ?, type = ?, provider = ?, start_date = ?, end_date = ?, cost = ?, cost_currency = ?, notes = ? WHERE id = ?`).run(
    String(merged.title).trim().slice(0, 200),
    TRAIN_TYPES.includes(merged.type) ? merged.type : ex.type,
    String(merged.provider || '').trim().slice(0, 200),
    merged.start_date || '',
    merged.end_date || '',
    merged.cost === '' || merged.cost == null ? null : Number(merged.cost) || null,
    merged.cost_currency || 'USD',
    String(merged.notes || '').slice(0, 2000),
    ex.id
  );
  if (Array.isArray(b.employee_ids)) {
    const keep = new Set(b.employee_ids.map(Number));
    const existing = db.prepare('SELECT employee_id FROM grh_training_attendees WHERE training_id = ?').all(ex.id).map((r) => r.employee_id);
    for (const eid of existing) if (!keep.has(eid)) {
      db.prepare('DELETE FROM grh_training_attendees WHERE training_id = ? AND employee_id = ?').run(ex.id, eid);
    }
    for (const eid of keep) if (!existing.includes(eid) && db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(eid)) {
      db.prepare('INSERT INTO grh_training_attendees (training_id, employee_id) VALUES (?, ?)').run(ex.id, eid);
    }
  }
  res.json(fetchTraining(ex.id));
});

app.delete('/api/admin/grh/trainings/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_training_attendees WHERE training_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_trainings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/grh/trainings/:id/attendees', ...GRH, (req, res) => {
  const t = db.prepare('SELECT id FROM grh_trainings WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Formation introuvable' });
  const emp = db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(req.body?.employee_id);
  if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
  if (db.prepare('SELECT id FROM grh_training_attendees WHERE training_id = ? AND employee_id = ?').get(t.id, emp.id))
    return res.status(409).json({ error: 'Cet employé est déjà inscrit à cette formation.' });
  const info = db.prepare('INSERT INTO grh_training_attendees (training_id, employee_id) VALUES (?, ?)').run(t.id, emp.id);
  res.json(db.prepare('SELECT * FROM grh_training_attendees WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/grh/trainings/attendees/:aid', ...GRH, (req, res) => {
  const a = db.prepare('SELECT * FROM grh_training_attendees WHERE id = ?').get(req.params.aid);
  if (!a) return res.status(404).json({ error: 'Inscription introuvable' });
  const status = TRAIN_STATUSES.includes(req.body?.status) ? req.body.status : a.status;
  db.prepare('UPDATE grh_training_attendees SET status = ?, completed_at = ? WHERE id = ?')
    .run(status, status === 'termine' ? (a.completed_at || new Date().toISOString().slice(0, 10)) : null, a.id);
  res.json(db.prepare('SELECT * FROM grh_training_attendees WHERE id = ?').get(a.id));
});

app.delete('/api/admin/grh/trainings/attendees/:aid', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_training_attendees WHERE id = ?').run(req.params.aid);
  res.json({ ok: true });
});

// ---------- Annonces internes ----------
app.get('/api/admin/grh/announcements', ...GRH, (req, res) => {
  res.json(db.prepare(`
    SELECT a.*, u.full_name AS created_by_name
    FROM grh_announcements a LEFT JOIN users u ON u.id = a.created_by
    ORDER BY a.pinned DESC, a.created_at DESC, a.id DESC
  `).all());
});

app.post('/api/admin/grh/announcements', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim() || !String(b.content || '').trim())
    return res.status(400).json({ error: 'Titre et contenu requis' });
  const info = db.prepare('INSERT INTO grh_announcements (title, content, pinned, expires_at, created_by) VALUES (?, ?, ?, ?, ?)').run(
    String(b.title).trim().slice(0, 200),
    String(b.content).slice(0, 8000),
    b.pinned ? 1 : 0,
    String(b.expires_at || '').slice(0, 10),
    req.user.id
  );
  res.json(db.prepare('SELECT * FROM grh_announcements WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/grh/announcements/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_announcements WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Annonce introuvable' });
  const b = { ...ex, ...req.body };
  if (!String(b.title).trim() || !String(b.content).trim())
    return res.status(400).json({ error: 'Titre et contenu requis' });
  db.prepare('UPDATE grh_announcements SET title = ?, content = ?, pinned = ?, expires_at = ? WHERE id = ?').run(
    String(b.title).trim().slice(0, 200),
    String(b.content).slice(0, 8000),
    b.pinned ? 1 : 0,
    String(b.expires_at || '').slice(0, 10),
    ex.id
  );
  res.json(db.prepare('SELECT * FROM grh_announcements WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/grh/announcements/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Projets ----------
const PROJECT_STATUSES = { planifie: 'Planifié', en_cours: 'En cours', cloture: 'Clôturé', annule: 'Annulé' };

app.get('/api/admin/grh/projects', ...GRH, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM grh_project_members m WHERE m.project_id = p.id) AS members_count,
      (SELECT COUNT(*) FROM grh_tasks t WHERE t.project_id = p.id) AS tasks_count,
      (SELECT COUNT(*) FROM grh_tasks t WHERE t.project_id = p.id AND t.status != 'terminee') AS open_tasks
    FROM grh_projects p
    ORDER BY p.created_at DESC, p.id DESC
  `).all();
  rows.forEach((p) => {
    p.members = db.prepare(`
      SELECT e.id, e.full_name, e.position
      FROM grh_project_members m JOIN grh_employees e ON e.id = m.employee_id
      WHERE m.project_id = ?
    `).all(p.id);
  });
  res.json(rows);
});

app.post('/api/admin/grh/projects', ...GRH, (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nom du projet requis' });
  const status = PROJECT_STATUSES[b.status] ? b.status : 'planifie';
  const memberIds = [...new Set((Array.isArray(b.member_ids) ? b.member_ids : []).map(Number).filter((n) => n > 0))];
  const info = runTx(() => {
    const r = db.prepare(`INSERT INTO grh_projects (name, description, client, deadline, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      String(b.name).trim().slice(0, 150),
      String(b.description || '').slice(0, 2000),
      String(b.client || '').trim().slice(0, 150),
      b.deadline ? String(b.deadline).slice(0, 10) : null,
      status,
      req.user.id
    );
    const ins = db.prepare('INSERT OR IGNORE INTO grh_project_members (project_id, employee_id) VALUES (?, ?)');
    for (const mid of memberIds) ins.run(r.lastInsertRowid, mid);
    return r.lastInsertRowid;
  });
  res.json(db.prepare('SELECT * FROM grh_projects WHERE id = ?').get(info));
});

app.put('/api/admin/grh/projects/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT * FROM grh_projects WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Projet introuvable' });
  const b = { ...ex, ...req.body };
  const status = PROJECT_STATUSES[b.status] ? b.status : 'planifie';
  const memberIds = [...new Set((Array.isArray(b.member_ids) ? b.member_ids : []).map(Number).filter((n) => n > 0))];
  runTx(() => {
    db.prepare(`UPDATE grh_projects SET name = ?, description = ?, client = ?, deadline = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?`).run(
      String(b.name).trim().slice(0, 150),
      String(b.description || '').slice(0, 2000),
      String(b.client || '').trim().slice(0, 150),
      b.deadline ? String(b.deadline).slice(0, 10) : null,
      status,
      ex.id
    );
    db.prepare('DELETE FROM grh_project_members WHERE project_id = ?').run(ex.id);
    const ins = db.prepare('INSERT OR IGNORE INTO grh_project_members (project_id, employee_id) VALUES (?, ?)');
    for (const mid of memberIds) ins.run(ex.id, mid);
  });
  res.json(db.prepare('SELECT * FROM grh_projects WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/grh/projects/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT id FROM grh_projects WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Projet introuvable' });
  runTx(() => {
    db.prepare('UPDATE grh_tasks SET project_id = NULL WHERE project_id = ?').run(ex.id);
    db.prepare('DELETE FROM grh_project_members WHERE project_id = ?').run(ex.id);
    db.prepare('DELETE FROM grh_projects WHERE id = ?').run(ex.id);
  });
  res.json({ ok: true });
});

// ---------- Tâches ----------
const TASK_STATUSES = { a_faire: 'À faire', en_cours: 'En cours', terminee: 'Terminée' };
const TASK_PRIORITIES = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };

const fetchTask = (id) => {
  const t = db.prepare(`
    SELECT t.*,
      a.full_name AS assignee_name, a.position AS assignee_position,
      p.name AS project_name, p.deadline AS project_deadline
    FROM grh_tasks t
    LEFT JOIN grh_employees a ON a.id = t.assignee_id
    LEFT JOIN grh_projects p ON p.id = t.project_id
    WHERE t.id = ?
  `).get(id);
  if (!t) return t;
  t.notes = db.prepare('SELECT * FROM grh_task_notes WHERE task_id = ? ORDER BY id').all(id);
  return t;
};

const taskListSql = `
  SELECT t.*, a.full_name AS assignee_name, p.name AS project_name
  FROM grh_tasks t
  LEFT JOIN grh_employees a ON a.id = t.assignee_id
  LEFT JOIN grh_projects p ON p.id = t.project_id
`;

app.get('/api/admin/grh/tasks', ...GRH, (req, res) => {
  const { project_id, assignee_id, status, q } = req.query;
  const where = [];
  const params = [];
  if (project_id) { where.push('t.project_id = ?'); params.push(project_id); }
  if (assignee_id) { where.push('t.assignee_id = ?'); params.push(assignee_id); }
  if (status && TASK_STATUSES[status]) { where.push('t.status = ?'); params.push(status); }
  if (q) { where.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  let sql = taskListSql;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY t.id DESC LIMIT 300';
  res.json(db.prepare(sql).all(...params));
});

const validateTaskBody = (b, partial = false) => {
  const out = {};
  if (!partial || b.title !== undefined) {
    if (!String(b.title || '').trim()) return { error: 'Intitulé de la tâche requis' };
    out.title = String(b.title).trim().slice(0, 200);
  }
  if (b.description !== undefined) out.description = String(b.description || '').slice(0, 3000);
  if (b.project_id !== undefined) {
    out.project_id = b.project_id ? Number(b.project_id) : null;
    if (out.project_id && !db.prepare('SELECT id FROM grh_projects WHERE id = ?').get(out.project_id))
      return { error: 'Projet introuvable' };
  }
  if (b.assignee_id !== undefined) {
    out.assignee_id = b.assignee_id ? Number(b.assignee_id) : null;
    if (out.assignee_id && !db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(out.assignee_id))
      return { error: 'Employé introuvable' };
  }
  if (b.priority !== undefined) {
    if (!TASK_PRIORITIES[b.priority]) return { error: 'Priorité invalide' };
    out.priority = b.priority;
  }
  if (b.due_date !== undefined) out.due_date = b.due_date ? String(b.due_date).slice(0, 10) : null;
  if (b.status !== undefined) {
    if (!TASK_STATUSES[b.status]) return { error: 'Statut invalide' };
    out.status = b.status;
  }
  return { out };
};

app.post('/api/admin/grh/tasks', ...GRH, (req, res) => {
  const b = req.body || {};
  const v = validateTaskBody(b);
  if (v.error) return res.status(400).json({ error: v.error });
  const o = v.out;
  const info = db.prepare(`INSERT INTO grh_tasks (title, description, project_id, assignee_id, priority, due_date, status, created_by, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    o.title,
    o.description || '',
    o.project_id ?? null,
    o.assignee_id ?? null,
    o.priority || 'normale',
    o.due_date ?? null,
    o.status || 'a_faire',
    req.user.id,
    o.status === 'terminee' ? new Date().toISOString().slice(0, 10) : null
  );
  res.json(fetchTask(info.lastInsertRowid));
});

app.put('/api/admin/grh/tasks/:id', ...GRH, (req, res) => {
  const ex = fetchTask(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Tâche introuvable' });
  const v = validateTaskBody(req.body || {}, true);
  if (v.error) return res.status(400).json({ error: v.error });
  const o = v.out;
  const nextStatus = o.status ?? ex.status;
  const completedAt = nextStatus === 'terminee' ? (ex.completed_at || new Date().toISOString().slice(0, 10)) : null;
  db.prepare(`UPDATE grh_tasks SET
      title = ?, description = ?, project_id = ?, assignee_id = ?, priority = ?, due_date = ?, status = ?, completed_at = ?, updated_at = datetime('now')
    WHERE id = ?`).run(
    o.title ?? ex.title,
    o.description ?? ex.description,
    o.project_id !== undefined ? o.project_id : ex.project_id,
    o.assignee_id !== undefined ? o.assignee_id : ex.assignee_id,
    o.priority ?? ex.priority,
    o.due_date !== undefined ? o.due_date : ex.due_date,
    nextStatus,
    completedAt,
    ex.id
  );
  res.json(fetchTask(ex.id));
});

const applyTaskStatus = (id, status, { authorId, authorName, note }) => {
  const ex = fetchTask(id);
  if (!ex) return { fail: 404, msg: 'Tâche introuvable' };
  if (!TASK_STATUSES[status]) return { fail: 400, msg: 'Statut invalide' };
  if (status === ex.status && !note) return { ok: ex };
  const completedAt = status === 'terminee' ? (ex.completed_at || new Date().toISOString().slice(0, 10)) : null;
  db.prepare(`UPDATE grh_tasks SET status = ?, completed_at = ?, updated_at = datetime('now') WHERE id = ?`).run(status, completedAt, ex.id);
  if (note) {
    db.prepare('INSERT INTO grh_task_notes (task_id, author_id, author_name, body) VALUES (?, ?, ?, ?)')
      .run(ex.id, authorId, authorName, String(note).slice(0, 1000));
  }
  return { ok: fetchTask(ex.id) };
};

app.patch('/api/admin/grh/tasks/:id/status', ...GRH, (req, res) => {
  const r = applyTaskStatus(req.params.id, (req.body || {}).status, {
    authorId: req.user.id,
    authorName: req.user.full_name || req.user.email,
    note: (req.body || {}).note
  });
  if (r.fail) return res.status(r.fail).json({ error: r.msg });
  res.json(r.ok);
});

app.get('/api/admin/grh/tasks/:id', ...GRH, (req, res) => {
  const t = fetchTask(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' });
  res.json(t);
});

app.post('/api/admin/grh/tasks/:id/notes', ...GRH, (req, res) => {
  const t = fetchTask(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' });
  const body = String((req.body || {}).body || '').trim().slice(0, 1000);
  if (!body) return res.status(400).json({ error: 'Commentaire requis' });
  const info = db.prepare('INSERT INTO grh_task_notes (task_id, author_id, author_name, body) VALUES (?, ?, ?, ?)')
    .run(t.id, req.user.id, req.user.full_name || req.user.email, body);
  res.json(db.prepare('SELECT * FROM grh_task_notes WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/admin/grh/tasks/:id', ...GRH, (req, res) => {
  const ex = db.prepare('SELECT id FROM grh_tasks WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Tâche introuvable' });
  runTx(() => {
    db.prepare('DELETE FROM grh_task_notes WHERE task_id = ?').run(ex.id);
    db.prepare('DELETE FROM grh_tasks WHERE id = ?').run(ex.id);
  });
  res.json({ ok: true });
});

// Fiche de tâche PDF (utilisée par l'admin et l'employé)
const buildTaskPdf = async (t) => {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const W = 595.28;
  const [font, fontBold] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold)
  ]);
  const brand = rgb(0.059, 0.227, 0.533);
  const ink = rgb(0.1, 0.12, 0.18);
  const gray = rgb(0.45, 0.5, 0.58);
  const siteName = getSetting('site_name') || 'ADI ONG';
  const tagline = getSetting('site_tagline') || '';
  const wrap = (text, size, maxWidth) => {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const trial = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && line) { lines.push(line); line = w; }
      else line = trial;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  page.drawRectangle({ x: 0, y: 841.89 - 88, width: W, height: 88, color: brand });
  page.drawText(siteName.toUpperCase(), { x: 40, y: 782, size: 18, font: fontBold, color: rgb(1, 1, 1) });
  if (tagline) page.drawText(tagline, { x: 40, y: 764, size: 9, font, color: rgb(0.85, 0.89, 0.95) });
  page.drawText('FICHE DE TÂCHE', { x: (W - fontBold.widthOfTextAtSize('FICHE DE TÂCHE', 20)) / 2, y: 716, size: 20, font: fontBold, color: ink });
  const meta = [`Tâche n° ${t.id}`, frDateLong(t.created_at)];
  page.drawText(meta.join('  ·  '), { x: W - 40 - font.widthOfTextAtSize(meta.join('  ·  '), 10), y: 718, size: 10, font, color: gray });

  let y = 676;
  const row = (label, value) => {
    page.drawText(label.toUpperCase(), { x: 40, y, size: 8, font: fontBold, color: gray });
    y -= 14;
    for (const line of wrap(value || '—', 11, 300)) {
      page.drawText(line, { x: 40, y, size: 11, font, color: ink });
      y -= 15;
    }
    y -= 8;
  };

  page.drawText(t.title, { x: 40, y, size: 15, font: fontBold, color: ink });
  y -= 24;
  const grid = (entries) => {
    const colW = 240;
    entries.forEach((e, i) => {
      const x = 40 + (i % 2) * (colW + 25);
      const labelY = y - Math.floor(i / 2) * 52;
      page.drawText(e.label, { x, y: labelY, size: 8, font: fontBold, color: gray });
      let ly = labelY - 14;
      for (const line of wrap(e.value, 11, colW - 10)) {
        page.drawText(line, { x, y: ly, size: 11, font, color: ink });
        ly -= 14;
      }
    });
    y -= Math.ceil(entries.length / 2) * 52 + 4;
  };
  grid([
    { label: 'ASSIGNÉ À', value: [t.assignee_name, t.assignee_position].filter(Boolean).join(' — ') },
    { label: 'PROJET', value: t.project_name || 'Projet non rattaché' },
    { label: 'PRIORITÉ', value: TASK_PRIORITIES[t.priority] || t.priority },
    { label: 'ÉCHÉANCE', value: t.due_date ? frDateLong(t.due_date) : 'Non définie' },
    { label: 'STATUT', value: TASK_STATUSES[t.status] || t.status },
    { label: 'TERMINÉE LE', value: t.completed_at ? frDateLong(t.completed_at) : 'En attente' }
  ]);
  if (t.project_deadline) {
    page.drawText(`Échéance du projet : ${frDateLong(t.project_deadline)}`, { x: 40, y, size: 10, font, color: gray });
    y -= 20;
  }

  page.drawText('DESCRIPTION', { x: 40, y, size: 8, font: fontBold, color: gray });
  y -= 14;
  for (const line of wrap(t.description || 'Aucune description.', 10.5, 515)) {
    page.drawText(line, { x: 40, y, size: 10.5, font, color: ink });
    y -= 14;
  }
  y -= 14;

  if (t.notes && t.notes.length) {
    page.drawText('HISTORIQUE DES ÉCHANGES', { x: 40, y, size: 8, font: fontBold, color: gray });
    y -= 16;
    for (const n of t.notes) {
      const head = `${frDateLong(n.created_at)} — ${n.author_name || 'Inconnu'}`;
      page.drawText(head, { x: 40, y, size: 9, font: fontBold, color: brand });
      y -= 12;
      for (const line of wrap(n.body, 9.5, 500)) {
        page.drawText(line, { x: 40, y, size: 9.5, font, color: ink });
        y -= 12;
      }
      y -= 6;
      if (y < 130) break;
    }
    y -= 10;
  }

  const sigY = Math.max(y - 30, 100);
  page.drawLine({ start: { x: 40, y: sigY + 46 }, end: { x: 555, y: sigY + 46 }, thickness: 0.7, color: rgb(0.8, 0.83, 0.88) });
  page.drawText('Signature de l’employé', { x: 40, y: sigY, size: 9, font, color: gray });
  page.drawLine({ start: { x: 40, y: sigY + 8 }, end: { x: 230, y: sigY + 8 }, thickness: 0.7, color: gray });
  page.drawText('Signature de la hiérarchie', { x: 340, y: sigY, size: 9, font, color: gray });
  page.drawLine({ start: { x: 340, y: sigY + 8 }, end: { x: 555, y: sigY + 8 }, thickness: 0.7, color: gray });
  const footer = [getSetting('address'), getSetting('phone1'), getSetting('email')].filter(Boolean).join('  ·  ');
  if (footer) page.drawText(footer.slice(0, 100), { x: (W - font.widthOfTextAtSize(footer.slice(0, 100), 7.5)) / 2, y: 45, size: 7.5, font, color: gray });

  return Buffer.from(await doc.save());
};

app.get('/api/admin/grh/tasks/:id/pdf', ...GRH, async (req, res) => {
  const t = fetchTask(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tâche introuvable' });
  try {
    const buf = await buildTaskPdf(t);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tache-${t.id}.pdf"`);
    res.send(buf);
  } catch {
    res.status(500).json({ error: 'Impossible de générer le PDF' });
  }
});

// ---------- Messagerie interne (employé ↔ administration) ----------
const chatFor = (employeeId) =>
  db.prepare(`SELECT c.*, u.full_name AS sender_name FROM grh_chat c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.employee_id = ? ORDER BY c.id`).all(employeeId);

app.get('/api/admin/grh/chat', ...GRH, (req, res) => {
  res.json(db.prepare(`
    SELECT e.id, e.full_name, e.position,
      (SELECT c.body FROM grh_chat c WHERE c.employee_id = e.id ORDER BY c.id DESC LIMIT 1) AS last_body,
      (SELECT c.created_at FROM grh_chat c WHERE c.employee_id = e.id ORDER BY c.id DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM grh_chat c WHERE c.employee_id = e.id AND c.sender = 'employee' AND c.read_at IS NULL) AS unread
    FROM grh_employees e
    ORDER BY COALESCE((SELECT c.created_at FROM grh_chat c WHERE c.employee_id = e.id ORDER BY c.id DESC LIMIT 1), e.created_at) DESC, e.id
  `).all());
});

app.get('/api/admin/grh/chat/:employeeId', ...GRH, (req, res) => {
  const emp = db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(req.params.employeeId);
  if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
  const msgs = chatFor(emp.id);
  db.prepare(`UPDATE grh_chat SET read_at = datetime('now')
    WHERE employee_id = ? AND sender = 'employee' AND read_at IS NULL`).run(emp.id);
  res.json(msgs);
});

app.post('/api/admin/grh/chat/:employeeId', ...GRH, (req, res) => {
  const emp = db.prepare('SELECT id FROM grh_employees WHERE id = ?').get(req.params.employeeId);
  if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
  const body = String((req.body || {}).body || '').trim().slice(0, 2000);
  if (!body) return res.status(400).json({ error: 'Message requis' });
  const info = db.prepare(`INSERT INTO grh_chat (employee_id, sender, user_id, body) VALUES (?, 'admin', ?, ?)`)
    .run(emp.id, req.user.id, body);
  res.json(db.prepare('SELECT * FROM grh_chat WHERE id = ?').get(info.lastInsertRowid));
});

// ---------- Documents administratifs ----------
const adminDocsDir = path.join(__dirname, 'data', 'admin-docs');
fs.mkdirSync(adminDocsDir, { recursive: true });
const adminDocsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, adminDocsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = isAllowedUpload(file) ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/pdf' ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ok) cb(null, true);
    else cb(new Error('Format de fichier non autorisé'));
  }
});

app.get('/api/admin/grh/admin-docs', ...GRH, (req, res) => {
  res.json(db.prepare(`
    SELECT d.*, u.full_name AS created_by_name
    FROM grh_admin_docs d LEFT JOIN users u ON u.id = d.created_by
    ORDER BY d.created_at DESC, d.id DESC
  `).all());
});

app.post('/api/admin/grh/admin-docs', ...GRH, adminDocsUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const b = req.body || {};
  const name = String(b.name || req.file.originalname || 'Document').trim().slice(0, 200);
  const info = db.prepare(`INSERT INTO grh_admin_docs (name, category, file, mime, size, expires_on, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    name,
    String(b.category || 'autre').trim().slice(0, 40) || 'autre',
    req.file.filename,
    String(req.file.mimetype || ''),
    req.file.size,
    b.expires_on ? String(b.expires_on).slice(0, 10) : null,
    req.user.id
  );
  res.json(db.prepare('SELECT * FROM grh_admin_docs WHERE id = ?').get(info.lastInsertRowid));
});

app.get('/api/admin/grh/admin-docs/:id/download', ...GRH, (req, res) => {
  const d = db.prepare('SELECT * FROM grh_admin_docs WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Document introuvable' });
  const full = path.join(adminDocsDir, path.basename(d.file));
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
  res.setHeader('Content-Type', d.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(d.name)}${path.extname(d.file)}"`);
  res.sendFile(full);
});

app.delete('/api/admin/grh/admin-docs/:id', ...GRH, (req, res) => {
  const d = db.prepare('SELECT * FROM grh_admin_docs WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Document introuvable' });
  db.prepare('DELETE FROM grh_admin_docs WHERE id = ?').run(d.id);
  const full = path.join(adminDocsDir, path.basename(d.file));
  fs.promises.unlink(full).catch(() => {});
  res.json({ ok: true });
});

// ---------- Certificats PDF (attestation d'emploi / certificat de travail) ----------
const CERT_CONTRACTS = {
  permanent: 'contrat permanent (CDI)',
  cdd: 'contrat à durée déterminée (CDD)',
  vacataire: 'contrat vacataire',
  benevole: 'engagement bénévole',
  stagiaire: 'contrat de stage'
};
const frDateLong = (iso) => {
  const d = new Date(String(iso || '').slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

app.get('/api/admin/grh/employees/:id/certificate', ...GRH, async (req, res) => {
  const type = String(req.query.type || 'emploi') === 'travail' ? 'travail' : 'emploi';
  const emp = db.prepare(`
    SELECT e.*, d.name AS department
    FROM grh_employees e LEFT JOIN grh_departments d ON d.id = e.department_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
  const today = new Date().toISOString().slice(0, 10);
  const endDate = type === 'travail' ? (String(req.query.end_date || '').slice(0, 10) || emp.leave_date || today) : '';
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const W = 595.28;
    const [font, fontBold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold)
    ]);
    const brand = rgb(0.059, 0.227, 0.533);
    const ink = rgb(0.1, 0.12, 0.18);
    const gray = rgb(0.45, 0.5, 0.58);
    const siteName = getSetting('site_name') || 'ADI ONG';
    const tagline = getSetting('site_tagline') || '';

    page.drawRectangle({ x: 0, y: 841.89 - 88, width: W, height: 88, color: brand });
    page.drawText(siteName.toUpperCase(), { x: 40, y: 782, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    if (tagline) page.drawText(tagline, { x: 40, y: 764, size: 9, font, color: rgb(0.85, 0.89, 0.95) });

    const title = type === 'travail' ? 'CERTIFICAT DE TRAVAIL' : "ATTESTATION D'EMPLOI";
    const issued = `Délivré le ${frDateLong(today)}`;
    page.drawText(title, { x: (W - fontBold.widthOfTextAtSize(title, 20)) / 2, y: 700, size: 20, font: fontBold, color: ink });
    page.drawText(issued, { x: W - 40 - font.widthOfTextAtSize(issued, 10), y: 676, size: 10, font, color: gray });

    const contract = CERT_CONTRACTS[emp.contract_type] || 'un contrat';
    const position = emp.position ? `, occupant le poste de ${emp.position}` : '';
    const dept = emp.department ? ` au sein du département ${emp.department}` : '';
    const hired = emp.hire_date ? frDateLong(emp.hire_date) : 'date non renseignée';
    const p1 = type === 'travail'
      ? `Nous soussignés, ${siteName}, attestons par la présente que ${emp.full_name} a été notre salarié(e) du ${hired} au ${frDateLong(endDate)}, dans le cadre d'un ${contract}${position}${dept}.`
      : `Nous soussignés, ${siteName}, attestons par la présente que ${emp.full_name} est notre salarié(e) depuis le ${hired}, dans le cadre d'un ${contract}${position}${dept}.`;
    const p2 = type === 'travail'
      ? "Pendant toute cette période, le ou la collaborateur(trice) a accompli ses fonctions avec sérieux et diligence. Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit."
      : 'La présente attestation est délivrée pour servir et valoir ce que de droit.';

    const wrap = (text) => {
      const words = String(text).split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, 11) > 475 && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };
    let y = 640;
    for (const para of [p1, p2]) {
      for (const line of wrap(para)) {
        page.drawText(line, { x: 60, y, size: 11, font, color: ink });
        y -= 16;
      }
      y -= 14;
    }

    page.drawText(`Fait le ${frDateLong(today)}`, { x: 60, y: 168, size: 10, font, color: ink });
    page.drawText('La direction', { x: 395, y: 178, size: 10, font: fontBold, color: ink });
    page.drawText(siteName, { x: 395, y: 146, size: 9, font, color: gray });
    page.drawLine({ start: { x: 395, y: 164 }, end: { x: 555, y: 164 }, thickness: 0.7, color: ink });

    const footer = [getSetting('address'), getSetting('phone1'), getSetting('email')].filter(Boolean).join('  ·  ');
    if (footer) page.drawText(footer, { x: 60, y: 60, size: 8, font, color: gray });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${emp.full_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
    res.send(Buffer.from(await doc.save()));
  } catch (e) {
    res.status(500).json({ error: 'Impossible de générer le PDF' });
  }
});

// ---------- Auto-service employé (compte lié au dossier par email) ----------
const LEAVE_TYPES_OK = ['conge', 'maladie', 'maternite', 'sans_solde', 'formation'];
const selfEmployee = (req) => {
  const em = String(req.user.email || '').toLowerCase();
  return db.prepare('SELECT * FROM grh_employees WHERE email IS NOT NULL AND lower(email) = ?').get(em) || null;
};
const selfEmployeeGuard = (req, res, next) => {
  const emp = selfEmployee(req);
  if (!emp) return res.status(404).json({ error: 'Aucun dossier employé n’est lié à votre adresse email.' });
  req.employee = emp;
  recordPresence(emp);
  next();
};

// Goma : UTC+2 fixe (Africa/Lubumbashi). Les instants sont stockés en UTC ; la date du jour est locale.
const ORG_TZ = 'Africa/Lubumbashi';
const orgParts = (date = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${hour}:${p.minute}` };
};
const utcStamp = (date = new Date()) => date.toISOString().slice(0, 19).replace('T', ' ');
/** HH:MM saisi à l'heure de Goma → horodatage UTC. */
const wallHmToUtc = (dateStr, hm) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 2, mi, 0)).toISOString().slice(0, 19).replace('T', ' ');
};
const utcStampToHm = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return String(v).slice(11, 16);
  return orgParts(d).hm;
};

// Pointage automatique : 1ʳᵉ activité de la journée = début, dernière activité = fin
const recordPresence = (emp) => {
  try {
    const now = new Date();
    const utc = utcStamp(now);
    db.prepare(`INSERT INTO grh_attendance (employee_id, date, clock_in, last_seen)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(employee_id, date) DO UPDATE SET last_seen = excluded.last_seen`)
      .run(emp.id, orgParts(now).date, utc, utc);
  } catch { /* non bloquant */ }
};
app.get('/api/me/employee', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const emp = req.employee;
  const dept = emp.department_id ? db.prepare('SELECT name FROM grh_departments WHERE id = ?').get(emp.department_id)?.name : '';
  res.json({ ...emp, salary: null, salary_currency: null, department: dept, balance: leaveBalance(emp.id) });
});
app.get('/api/me/employee/leaves', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  res.json(db.prepare('SELECT * FROM grh_leaves WHERE employee_id = ? ORDER BY start_date DESC').all(req.employee.id));
});
app.get('/api/me/employee/attendance', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  res.json(db.prepare(`SELECT * FROM grh_attendance
    WHERE employee_id = ? AND date >= date('now', '-60 days')
    ORDER BY date DESC`).all(req.employee.id));
});

// Battement de « Mon espace » : renouvelle l'heure de fin tant que l'employé est dans son espace de travail
app.post('/api/me/attendance/ping', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  recordPresence(req.employee);
  const row = db.prepare('SELECT * FROM grh_attendance WHERE employee_id = ? AND date = ?').get(req.employee.id, orgParts().date);
  res.json({ ok: true, ...row });
});

app.get('/api/me/employee/announcements', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(db.prepare(`
    SELECT id, title, content, pinned, expires_at, created_at
    FROM grh_announcements
    WHERE expires_at = '' OR expires_at >= ?
    ORDER BY pinned DESC, created_at DESC, id DESC
  `).all(today));
});
const myLeaveLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `myleave:${req.user?.id || req.ip}`, message: 'Trop de demandes de congé. Réessayez plus tard.' });
app.post('/api/me/employee/leaves', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.request'), selfEmployeeGuard, myLeaveLimiter, (req, res) => {
  const b = req.body || {};
  if (!b.start_date) return res.status(400).json({ error: 'Date de début requise' });
  const type = LEAVE_TYPES_OK.includes(b.type) ? b.type : 'conge';
  const days = businessDays(b.start_date, b.end_date || b.start_date);
  if (!days) return res.status(400).json({ error: 'Dates invalides (la fin doit être après le début)' });
  if (type === 'conge') {
    const bal = leaveBalance(req.employee.id);
    if (bal.used + days > bal.annual)
      return res.status(400).json({ error: `Solde insuffisant : ${bal.remaining} jour(s) restant(s) cette année.` });
  }
  const info = db.prepare(
    'INSERT INTO grh_leaves (employee_id, type, start_date, end_date, reason, status, days) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.employee.id, type, b.start_date, b.end_date || '', String(b.reason || '').slice(0, 500), 'en_attente', days);
  res.json(db.prepare('SELECT * FROM grh_leaves WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/me/employee/leaves/:id', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const leave = db.prepare('SELECT * FROM grh_leaves WHERE id = ? AND employee_id = ?').get(req.params.id, req.employee.id);
  if (!leave) return res.status(404).json({ error: 'Demande introuvable' });
  if (leave.status !== 'en_attente') return res.status(409).json({ error: 'Seule une demande en attente peut être retirée.' });
  db.prepare('DELETE FROM grh_leaves WHERE id = ?').run(leave.id);
  res.json({ ok: true });
});

app.get('/api/me/grh/tasks', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, p.name AS project_name
    FROM grh_tasks t LEFT JOIN grh_projects p ON p.id = t.project_id
    WHERE t.assignee_id = ?
    ORDER BY CASE t.status WHEN 'a_faire' THEN 0 WHEN 'en_cours' THEN 1 ELSE 2 END, t.due_date IS NULL, t.due_date, t.id DESC
  `).all(req.employee.id));
});

app.get('/api/me/grh/tasks/:id', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const t = fetchTask(req.params.id);
  if (!t || t.assignee_id !== req.employee.id) return res.status(404).json({ error: 'Tâche introuvable' });
  res.json(t);
});

app.patch('/api/me/grh/tasks/:id/status', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const ex = fetchTask(req.params.id);
  if (!ex || ex.assignee_id !== req.employee.id) return res.status(404).json({ error: 'Tâche introuvable' });
  const r = applyTaskStatus(ex.id, (req.body || {}).status, {
    authorId: req.user.id,
    authorName: req.employee.full_name,
    note: (req.body || {}).note
  });
  if (r.fail) return res.status(r.fail).json({ error: r.msg });
  res.json(r.ok);
});

app.post('/api/me/grh/tasks/:id/notes', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const ex = fetchTask(req.params.id);
  if (!ex || ex.assignee_id !== req.employee.id) return res.status(404).json({ error: 'Tâche introuvable' });
  const body = String((req.body || {}).body || '').trim().slice(0, 1000);
  if (!body) return res.status(400).json({ error: 'Commentaire requis' });
  const info = db.prepare('INSERT INTO grh_task_notes (task_id, author_id, author_name, body) VALUES (?, ?, ?, ?)')
    .run(ex.id, req.user.id, req.employee.full_name, body);
  res.json(db.prepare('SELECT * FROM grh_task_notes WHERE id = ?').get(info.lastInsertRowid));
});

app.get('/api/me/grh/tasks/:id/pdf', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, async (req, res) => {
  const t = fetchTask(req.params.id);
  if (!t || t.assignee_id !== req.employee.id) return res.status(404).json({ error: 'Tâche introuvable' });
  try {
    const buf = await buildTaskPdf(t);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tache-${t.id}.pdf"`);
    res.send(buf);
  } catch {
    res.status(500).json({ error: 'Impossible de générer le PDF' });
  }
});

app.get('/api/me/chat', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  db.prepare(`UPDATE grh_chat SET read_at = datetime('now')
    WHERE employee_id = ? AND sender = 'admin' AND read_at IS NULL`).run(req.employee.id);
  res.json(chatFor(req.employee.id));
});

app.post('/api/me/chat', authRequired, requireModule('grh_enabled', 'GRH'), requirePerm('leave.view'), selfEmployeeGuard, (req, res) => {
  const body = String((req.body || {}).body || '').trim().slice(0, 2000);
  if (!body) return res.status(400).json({ error: 'Message requis' });
  const info = db.prepare(`INSERT INTO grh_chat (employee_id, sender, user_id, body) VALUES (?, 'employee', ?, ?)`)
    .run(req.employee.id, req.user.id, body);
  res.json(db.prepare('SELECT * FROM grh_chat WHERE id = ?').get(info.lastInsertRowid));
});

// ---------- Messagerie d'équipe (style WhatsApp) : entre comptes de la plateforme ----------
const requireChat = (req, res, next) => {
  if (getSetting('chat_enabled') === '0')
    return res.status(403).json({ error: 'Module Messagerie désactivé par le super administrateur.' });
  next();
};
const CHAT = [authRequired, requireChat, requirePerm('chat.view')];
const chatLimiter = rateLimit({ windowMs: 60_000, max: 40, key: (req) => `chat:${req.user?.id || req.ip}`, message: 'Vous envoyez les messages trop rapidement — patientez un instant.' });
const chatDir = path.join(uploadDir, 'chat');
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
const isAllowedChatFile = (file) => {
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  if (isAllowedUpload(file)) return true;
  if (/^audio\/(webm|ogg|opus|mp4|m4a|x-m4a|mpeg|mp3)$/.test(mime) || /\.(webm|ogg|opus|m4a|mp4|mp3)$/.test(name)) return true;
  if (/^(application\/(msword|vnd\.|zip|x-zip)|text\/plain)/.test(mime)) return true;
  if (/\.(docx?|xlsx?|pptx?|zip|txt|csv)$/.test(name)) return true;
  return false;
};
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, chatDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
      cb(null, `chat-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isAllowedChatFile(file)) cb(null, true);
    else cb(new Error('Format non supporté (image, PDF, document ou audio)'));
  }
});
const compressChatImage = (full) => {
  try {
    if (!/\.(jpe?g|png|webp)$/i.test(full)) return;
    Jimp.read(full)
      .then((img) => {
        if (img.bitmap.width > 1600 || img.bitmap.height > 1600) img.contain(1600, 1600);
        else return;
        return img.write(full);
      })
      .catch(() => {});
  } catch { /* image illisible : on garde l'originale */ }
};

const authChatFile = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : String(req.query?.access || '').trim() || null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  if (revokedTokens.has(tokenHash(token))) return res.status(401).json({ error: 'Session révoquée, reconnectez-vous' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const fresh = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    req.user.role = fresh?.role || 'viewer';
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
  }
};
app.get('/uploads/chat/:file', authChatFile, requireChat, (req, res) => {
  const file = path.basename(req.params.file);
  const url = `/uploads/chat/${file}`;
  const isAvatar = db.prepare('SELECT 1 FROM chat_conversations WHERE avatar = ?').get(url);
  if (!isAvatar) {
    const ok = db.prepare(`SELECT 1 FROM chat_messages m
      WHERE m.attachment = ? AND m.deleted_at = ''
      AND m.conversation_id IN (SELECT conversation_id FROM chat_members WHERE user_id = ?)`).get(url, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Fichier introuvable' });
  }
  const full = path.join(chatDir, file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.sendFile(full);
});
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

const CHAT_ROLE_LABELS = { proprietaire: 'Propriétaire', moderateur: 'Modérateur', membre: 'Membre' };
const chatIsMod = (req) => req.chat && req.chat.conv.type === 'group' && ['proprietaire', 'moderateur'].includes(req.chat.mem.role);
const guardChatConv = (req, res, next) => {
  const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(Number(req.params.id));
  if (!conv) return res.status(404).json({ error: 'Conversation introuvable' });
  const mem = db.prepare('SELECT * FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id);
  if (!mem) return res.status(403).json({ error: 'Vous ne faites pas partie de cette conversation' });
  if (conv.type === 'dm' && req.user.role !== 'super_admin') {
    const other = db.prepare(`SELECT u.role FROM chat_members m JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ? AND m.user_id != ?`).get(conv.id, req.user.id);
    if (hiddenSuper(other?.role, req.user.role)) return res.status(404).json({ error: 'Conversation introuvable' });
  }
  req.chat = { conv, mem };
  next();
};
const ROLE_LABEL_CHAT = { super_admin: 'Super admin', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Consultation', cashier: 'Caissier' };
const chatPublicUser = (u) => u && ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  photo: u.photo || '',
  job_title: u.job_title || '',
  position: u.job_title || ROLE_LABEL_CHAT[u.role] || u.role || ''
});
const chatStaffList = (actorRole) =>
  db.prepare(`SELECT id, full_name, email, role, photo, job_title FROM users ORDER BY full_name`).all()
    .filter((u) => !hiddenSuper(u.role, actorRole))
    .map((u) => ({ ...chatPublicUser(u), department_name: ROLE_LABEL_CHAT[u.role] || u.role }));
const chatUnread = (convId, userId) =>
  db.prepare(`SELECT COUNT(*) n FROM chat_messages
    WHERE conversation_id = ? AND sender_id != ? AND deleted_at = ''
    AND created_at > COALESCE((SELECT read_at FROM chat_reads WHERE conversation_id = ? AND user_id = ?), '1970-01-01')`)
    .get(convId, userId, convId, userId).n;
const chatConvView = (conv, user) => {
  const uid = user.id;
  const mem = db.prepare('SELECT * FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, uid);
  const row = {
    id: conv.id,
    type: conv.type,
    name: conv.name,
    description: conv.description,
    avatar: conv.avatar,
    join_policy: conv.join_policy,
    owner_id: conv.owner_id,
    my_role: mem?.role || (conv.type === 'group' && conv.owner_id === uid ? 'proprietaire' : 'membre'),
    member_count: (() => {
      const total = db.prepare('SELECT COUNT(*) n FROM chat_members WHERE conversation_id = ?').get(conv.id).n;
      if (user.role === 'super_admin') return total;
      const hidden = db.prepare(`SELECT COUNT(*) n FROM chat_members m JOIN users u ON u.id = m.user_id
        WHERE m.conversation_id = ? AND u.role = 'super_admin'`).get(conv.id).n;
      return Math.max(0, total - hidden);
    })(),
    muted: mem?.muted === 1,
    unread: chatUnread(conv.id, uid),
    last_message_at: conv.last_message_at,
    last_message_body: conv.last_message_body,
    last_message_sender: conv.last_message_sender
  };
  if (conv.type === 'dm') {
    const other = db.prepare('SELECT m.user_id FROM chat_members m WHERE m.conversation_id = ? AND m.user_id != ?').get(conv.id, uid);
    const o = other?.user_id
      ? db.prepare('SELECT id, full_name, email, role, photo, job_title FROM users WHERE id = ?').get(other.user_id)
      : null;
    row.name = o?.full_name || 'Discussion';
    row.avatar = o?.photo || '';
    row.other = chatPublicUser(o);
    if (hiddenSuper(o?.role, user.role)) return null;
  }
  if (user.role !== 'super_admin' && row.last_message_sender) {
    const fromSuper = db.prepare("SELECT 1 AS n FROM users WHERE role = 'super_admin' AND full_name = ?").get(row.last_message_sender);
    if (fromSuper) {
      row.last_message_sender = '';
      row.last_message_body = '';
    }
  }
  return row;
};
const chatTouchLast = (convId, msg) => {
  const sender = db.prepare('SELECT full_name FROM users WHERE id = ?').get(msg.sender_id);
  db.prepare('UPDATE chat_conversations SET last_message_at = ?, last_message_body = ?, last_message_sender = ? WHERE id = ?')
    .run(msg.created_at, (msg.body || '').slice(0, 140), sender?.full_name || '', convId);
};

app.post('/api/chat/upload', ...CHAT, requirePerm('chat.send'), (req, res) => {
  chatUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    compressChatImage(req.file.path);
    res.json({ url: `/uploads/chat/${req.file.filename}`, name: req.file.originalname, mime: req.file.mimetype });
  });
});

app.get('/api/chat/unread', ...CHAT, (req, res) => {
  const rows = db.prepare('SELECT conversation_id FROM chat_members WHERE user_id = ? AND muted = 0').all(req.user.id);
  let count = 0;
  for (const r of rows) {
    if (req.user.role !== 'super_admin') {
      const conv = db.prepare('SELECT type FROM chat_conversations WHERE id = ?').get(r.conversation_id);
      if (conv?.type === 'dm') {
        const other = db.prepare(`SELECT u.role FROM chat_members m JOIN users u ON u.id = m.user_id
          WHERE m.conversation_id = ? AND m.user_id != ?`).get(r.conversation_id, req.user.id);
        if (hiddenSuper(other?.role, req.user.role)) continue;
      }
    }
    count += chatUnread(r.conversation_id, req.user.id);
  }
  res.json({ count });
});

app.put('/api/chat/conversations/:id/mute', ...CHAT, guardChatConv, (req, res) => {
  const muted = req.body?.muted ? 1 : 0;
  db.prepare('UPDATE chat_members SET muted = ? WHERE conversation_id = ? AND user_id = ?').run(muted, req.chat.conv.id, req.user.id);
  res.json({ ok: true, muted: !!muted });
});

app.post('/api/chat/:id/typing', ...CHAT, guardChatConv, (req, res) => {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const meName = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user.id)?.full_name || '';
  db.prepare('UPDATE chat_conversations SET last_typing_at = ?, last_typing_name = ?, last_typing_by = ? WHERE id = ?')
    .run(now, meName, req.user.id, req.chat.conv.id);
  res.json({ ok: true });
});

const CHAT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
app.put('/api/chat/messages/:id/react', ...CHAT, (req, res) => {
  const m = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(req.params.id));
  if (!m || m.deleted_at) return res.status(404).json({ error: 'Message introuvable' });
  const mem = db.prepare('SELECT 1 FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(m.conversation_id, req.user.id);
  if (!mem) return res.status(403).json({ error: 'Conversation introuvable' });
  const emoji = CHAT_EMOJIS.includes(req.body?.emoji) ? req.body.emoji : null;
  const cur = db.prepare('SELECT emoji FROM chat_reactions WHERE message_id = ? AND user_id = ?').get(m.id, req.user.id);
  if (!emoji || (cur && cur.emoji === emoji)) {
    db.prepare('DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ?').run(m.id, req.user.id);
  } else {
    db.prepare('INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?) ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji')
      .run(m.id, req.user.id, emoji);
  }
  res.json({ ok: true });
});

app.get('/api/chat/staff', ...CHAT, (req, res) => {
  res.json(chatStaffList(req.user.role).map((e) => ({ ...e, is_me: e.id === req.user.id })));
});

app.get('/api/chat/conversations', ...CHAT, (req, res) => {
  const rows = db.prepare(`SELECT c.* FROM chat_conversations c
    JOIN chat_members m ON m.conversation_id = c.id AND m.user_id = ?
    ORDER BY (c.last_message_at = '') DESC, c.last_message_at DESC, c.id DESC`).all(req.user.id);
  res.json(rows.map((c) => chatConvView(c, req.user)).filter(Boolean));
});

app.post('/api/chat/dm', ...CHAT, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.body?.user_id));
  if (!target || hiddenSuper(target.role, req.user.role)) return res.status(404).json({ error: 'Compte introuvable' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Impossible de discuter avec soi-même' });
  const [a, b] = [req.user.id, target.id].sort((x, y) => x - y);
  let conv = db.prepare(`SELECT c.* FROM chat_conversations c
    WHERE c.type = 'dm' AND c.id IN (
      SELECT conversation_id FROM chat_members WHERE user_id = ?
      INTERSECT SELECT conversation_id FROM chat_members WHERE user_id = ?
    ) LIMIT 1`).get(a, b);
  if (!conv) {
    const info = db.prepare(`INSERT INTO chat_conversations (type, created_by) VALUES ('dm', ?)`).run(req.user.id);
    const cid = info.lastInsertRowid;
    db.prepare('INSERT INTO chat_members (conversation_id, user_id, role) VALUES (?, ?, \'membre\')').run(cid, a);
    db.prepare('INSERT INTO chat_members (conversation_id, user_id, role) VALUES (?, ?, \'membre\')').run(cid, b);
    conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(cid);
  }
  res.json(chatConvView(conv, req.user));
});

app.post('/api/chat/groups', ...CHAT, requirePerm('chat.groups'), (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: 'Nom du groupe requis' });
  const ids = new Set([req.user.id]);
  for (const x of Array.isArray(b.member_ids) ? b.member_ids : []) {
    const emp = db.prepare('SELECT id, role FROM users WHERE id = ?').get(Number(x));
    if (emp && !hiddenSuper(emp.role, req.user.role)) ids.add(emp.id);
  }
  if (ids.size < 2) return res.status(400).json({ error: 'Un groupe doit compter au moins 2 membres' });
  const info = db.prepare(`INSERT INTO chat_conversations (type, name, description, avatar, join_policy, owner_id, created_by)
    VALUES ('group', ?, ?, ?, ?, ?, ?)`)
    .run(
      name,
      String(b.description || '').trim().slice(0, 300),
      String(b.avatar || '').slice(0, 300),
      b.join_policy === 'ouvert' ? 'ouvert' : 'ferme',
      req.user.id,
      req.user.id
    );
  const cid = info.lastInsertRowid;
  const ins = db.prepare('INSERT INTO chat_members (conversation_id, user_id, role) VALUES (?, ?, ?)');
  for (const id of ids) ins.run(cid, id, id === req.user.id ? 'proprietaire' : 'membre');
  res.json(chatConvView(db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(cid), req.user));
});

app.put('/api/chat/conversations/:id', ...CHAT, guardChatConv, (req, res) => {
  if (req.chat.conv.type !== 'group') return res.status(400).json({ error: 'Paramétrage réservé aux groupes' });
  if (!chatIsMod(req)) return res.status(403).json({ error: 'Réservé au propriétaire et aux modérateurs' });
  const b = req.body || {};
  const c = req.chat.conv;
  db.prepare('UPDATE chat_conversations SET name = ?, description = ?, avatar = ?, join_policy = ? WHERE id = ?').run(
    b.name !== undefined ? String(b.name).trim().slice(0, 80) || c.name : c.name,
    b.description !== undefined ? String(b.description).trim().slice(0, 300) : c.description,
    b.avatar !== undefined ? String(b.avatar).slice(0, 300) : c.avatar,
    b.join_policy === 'ouvert' || b.join_policy === 'ferme' ? b.join_policy : c.join_policy,
    c.id
  );
  res.json(chatConvView(db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(c.id), req.user));
});

app.delete('/api/chat/conversations/:id', ...CHAT, guardChatConv, (req, res) => {
  const { conv } = req.chat;
  if (conv.type !== 'group' || conv.owner_id !== req.user.id)
    return res.status(403).json({ error: 'Seul le propriétaire d’un groupe peut le supprimer' });
  const msgs = db.prepare('SELECT * FROM chat_messages WHERE conversation_id = ?').all(conv.id);
  msgs.forEach((m) => { if (m.attachment) safeUnlink(path.join(chatDir, path.basename(m.attachment))); });
  db.prepare('DELETE FROM chat_pins WHERE conversation_id = ?').run(conv.id);
  db.prepare('DELETE FROM chat_reads WHERE conversation_id = ?').run(conv.id);
  db.prepare('DELETE FROM chat_members WHERE conversation_id = ?').run(conv.id);
  db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(conv.id);
  db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(conv.id);
  res.json({ ok: true });
});

app.get('/api/chat/conversations/:id/members', ...CHAT, guardChatConv, (req, res) => {
  const rows = db.prepare(`SELECT m.*, e.full_name, e.job_title AS position, e.photo, e.role AS emp_status
    FROM chat_members m JOIN users e ON e.id = m.user_id
    WHERE m.conversation_id = ? ORDER BY
      CASE m.role WHEN 'proprietaire' THEN 0 WHEN 'moderateur' THEN 1 ELSE 2 END, e.full_name`).all(req.chat.conv.id);
  res.json(rows.filter((r) => !hiddenSuper(r.emp_status, req.user.role)).map((r) => ({
    id: r.user_id,
    full_name: r.full_name, position: r.position || ROLE_LABEL_CHAT[r.emp_status] || r.emp_status, photo: r.photo,
    is_active: true,
    role: r.role,
    role_label: CHAT_ROLE_LABELS[r.role] || r.role,
    is_me: r.user_id === req.user.id
  })));
});

app.post('/api/chat/conversations/:id/members', ...CHAT, guardChatConv, (req, res) => {
  const { conv, mem } = req.chat;
  const selfId = req.user.id;
  const targetId = Number(req.body?.user_id) || selfId;
  const isSelf = targetId === selfId;
  if (!isSelf && !chatIsMod(req)) return res.status(403).json({ error: 'Réservé au propriétaire et aux modérateurs' });
  if (isSelf && conv.join_policy !== 'ouvert') return res.status(403).json({ error: 'Ce groupe est fermé — demandez à un modérateur de vous y ajouter' });
  const emp = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (emp && hiddenSuper(emp.role, req.user.role)) return res.status(404).json({ error: 'Compte introuvable' });
  if (!emp) return res.status(404).json({ error: 'Compte introuvable' });
  if (db.prepare('SELECT 1 FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, targetId))
    return res.status(409).json({ error: 'Cette personne est déjà membre du groupe' });
  let role = 'membre';
  if (req.body?.role && mem.role === 'proprietaire') {
    if (!['moderateur', 'membre'].includes(req.body.role)) return res.status(400).json({ error: 'Rôle invalide' });
    role = req.body.role;
  }
  db.prepare('INSERT INTO chat_members (conversation_id, user_id, role) VALUES (?, ?, ?)').run(conv.id, targetId, role);
  res.json({ ok: true });
});

app.put('/api/chat/conversations/:id/members/:userId', ...CHAT, guardChatConv, (req, res) => {
  const { conv, mem } = req.chat;
  const targetId = Number(req.params.userId);
  if (mem.role !== 'proprietaire') return res.status(403).json({ error: 'Seul le propriétaire peut changer les rôles' });
  const target = db.prepare('SELECT * FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, targetId);
  if (!target) return res.status(404).json({ error: 'Membre introuvable' });
  if (target.role === 'proprietaire') return res.status(400).json({ error: 'Impossible de modifier le propriétaire' });
  const role = ['moderateur', 'membre'].includes(req.body?.role) ? req.body.role : null;
  if (!role) return res.status(400).json({ error: 'Rôle invalide' });
  db.prepare('UPDATE chat_members SET role = ? WHERE conversation_id = ? AND user_id = ?').run(role, conv.id, targetId);
  res.json({ ok: true });
});

app.delete('/api/chat/conversations/:id/members/:userId', ...CHAT, guardChatConv, (req, res) => {
  const { conv, mem } = req.chat;
  const targetId = Number(req.params.userId);
  const self = targetId === req.user.id;
  if (conv.type === 'dm') return res.status(400).json({ error: 'Retirez simplement la discussion de votre liste' });
  const target = db.prepare('SELECT * FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, targetId);
  if (!target) return res.status(404).json({ error: 'Membre introuvable' });
  if (self) {
    if (target.role === 'proprietaire') return res.status(400).json({ error: 'Le propriétaire ne peut pas quitter — supprimez le groupe' });
  } else {
    if (!chatIsMod(req)) return res.status(403).json({ error: 'Réservé au propriétaire et aux modérateurs' });
    if (target.role === 'proprietaire') return res.status(403).json({ error: 'Impossible de retirer le propriétaire' });
  }
  db.prepare('DELETE FROM chat_members WHERE conversation_id = ? AND user_id = ?').run(conv.id, targetId);
  const left = db.prepare('SELECT COUNT(*) n FROM chat_members WHERE conversation_id = ?').get(conv.id).n;
  if (left < 2) {
    const msgs = db.prepare('SELECT * FROM chat_messages WHERE conversation_id = ?').all(conv.id);
    msgs.forEach((m) => { if (m.attachment) safeUnlink(path.join(chatDir, path.basename(m.attachment))); });
    db.prepare('DELETE FROM chat_pins WHERE conversation_id = ?').run(conv.id);
    db.prepare('DELETE FROM chat_reads WHERE conversation_id = ?').run(conv.id);
    db.prepare('DELETE FROM chat_members WHERE conversation_id = ?').run(conv.id);
    db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(conv.id);
    db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(conv.id);
    return res.json({ ok: true, deleted: true });
  }
  res.json({ ok: true });
});

app.get('/api/chat/search', ...CHAT, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const rows = db.prepare(`SELECT m.id, m.conversation_id, m.body, m.created_at, m.deleted_at,
      e.full_name AS sender_name, e.role AS sender_role, c.type, c.name,
      (SELECT full_name FROM users oe WHERE oe.id = (SELECT user_id FROM chat_members cm2 WHERE cm2.conversation_id = c.id AND cm2.user_id != ?) LIMIT 1) AS other_name,
      (SELECT role FROM users oe WHERE oe.id = (SELECT user_id FROM chat_members cm2 WHERE cm2.conversation_id = c.id AND cm2.user_id != ?) LIMIT 1) AS other_role
    FROM chat_messages m
    JOIN chat_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
    JOIN chat_conversations c ON c.id = m.conversation_id
    LEFT JOIN users e ON e.id = m.sender_id
    WHERE m.body LIKE ? AND m.deleted_at = ''
    ORDER BY m.id DESC LIMIT 50`).all(req.user.id, req.user.id, req.user.id, like);
  res.json(rows.filter((r) => actorIsSuper(req) || (!hiddenSuper(r.sender_role, req.user.role) && !(r.type === 'dm' && hiddenSuper(r.other_role, req.user.role)))).map((r) => ({
    ...r,
    conversation_name: r.type === 'group' ? r.name : (r.other_name || 'Discussion')
  })));
});

app.get('/api/chat/open-groups', ...CHAT, (req, res) => {
  const rows = db.prepare(`SELECT c.* FROM chat_conversations c
    WHERE c.type = 'group' AND c.join_policy = 'ouvert'
    AND c.id NOT IN (SELECT conversation_id FROM chat_members WHERE user_id = ?)
    ORDER BY c.id DESC LIMIT 20`).all(req.user.id);
  res.json(rows.map((c) => chatConvView(c, req.user)));
});

app.post('/api/chat/groups/:id/join', ...CHAT, (req, res) => {
  const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(Number(req.params.id));
  if (!conv || conv.type !== 'group') return res.status(404).json({ error: 'Groupe introuvable' });
  if (db.prepare('SELECT 1 FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(conv.id, req.user.id))
    return res.status(409).json({ error: 'Vous êtes déjà membre de ce groupe' });
  if (conv.join_policy !== 'ouvert') return res.status(403).json({ error: 'Ce groupe est fermé — demandez à un modérateur de vous y ajouter' });
  db.prepare('INSERT INTO chat_members (conversation_id, user_id, role) VALUES (?, ?, \'membre\')').run(conv.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/chat/:id', ...CHAT, guardChatConv, (req, res) => {
  const convId = req.chat.conv.id;
  let msgs = db.prepare(`SELECT m.*, e.full_name AS sender_name, e.role AS sender_role, e.job_title AS sender_position, e.photo AS sender_photo,
      r.body AS reply_body, re.full_name AS reply_sender_name, re.role AS reply_sender_role,
      CASE WHEN p.message_id IS NOT NULL THEN 1 ELSE 0 END AS pinned
    FROM chat_messages m
    LEFT JOIN users e ON e.id = m.sender_id
    LEFT JOIN chat_messages r ON r.id = m.reply_to
    LEFT JOIN users re ON re.id = r.sender_id
    LEFT JOIN chat_pins p ON p.message_id = m.id AND p.conversation_id = m.conversation_id
    WHERE m.conversation_id = ?
    ORDER BY m.id DESC LIMIT 200`).all(convId).reverse();
  if (!actorIsSuper(req)) {
    msgs = msgs.filter((m) => !hiddenSuper(m.sender_role, req.user.role));
    for (const m of msgs) {
      if (hiddenSuper(m.reply_sender_role, req.user.role)) m.reply_sender_name = '';
    }
  }
  const reads = db.prepare('SELECT user_id, read_at FROM chat_reads WHERE conversation_id = ?').all(convId);
  const ids = msgs.map((m) => m.id);
  const reacRows = ids.length
    ? db.prepare(`SELECT message_id, user_id, emoji FROM chat_reactions
        WHERE message_id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : [];
  const reacByMsg = {};
  for (const r of reacRows) (reacByMsg[r.message_id] ||= []).push(r);
  msgs.forEach((m) => {
    m.read = 0;
    if (m.sender_id === req.user.id)
      m.read = reads.some((r) => r.user_id !== req.user.id && r.read_at >= m.created_at) ? 1 : 0;
    const byEmoji = {};
    for (const r of reacByMsg[m.id] || []) {
      (byEmoji[r.emoji] ||= { emoji: r.emoji, count: 0, mine: false }).count += 1;
      if (r.user_id === req.user.id) byEmoji[r.emoji].mine = true;
    }
    m.reactions = Object.values(byEmoji);
  });
  db.prepare(`INSERT INTO chat_reads (conversation_id, user_id, read_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(conversation_id, user_id) DO UPDATE SET read_at = datetime('now')`).run(convId, req.user.id);
  let pins = db.prepare(`SELECT m.*, e.full_name AS sender_name, e.role AS sender_role, p.pinned_at
    FROM chat_pins p JOIN chat_messages m ON m.id = p.message_id
    LEFT JOIN users e ON e.id = m.sender_id
    WHERE p.conversation_id = ? AND m.deleted_at = ''
    ORDER BY p.pinned_at DESC LIMIT 10`).all(convId);
  if (!actorIsSuper(req)) pins = pins.filter((p) => !hiddenSuper(p.sender_role, req.user.role));
  const convRow = req.chat.conv;
  let typing = convRow.last_typing_by && convRow.last_typing_by !== req.user.id
    ? { name: convRow.last_typing_name || '', at: convRow.last_typing_at || '' }
    : null;
  if (typing && !actorIsSuper(req) && hiddenSuper(
    db.prepare('SELECT role FROM users WHERE id = ?').get(convRow.last_typing_by)?.role,
    req.user.role
  )) typing = null;
  res.json({ conversation: chatConvView(req.chat.conv, req.user), messages: msgs, pins, me: req.user.id, typing });
});


app.post('/api/chat/:id/messages', ...CHAT, requirePerm('chat.send'), guardChatConv, chatLimiter, (req, res) => {
  const finish = (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { conv } = req.chat;
    const body = String(req.body?.body || '').trim().slice(0, 4000);
    const replyTo = Number(req.body?.reply_to) || 0;
    const attachment = req.file ? `/uploads/chat/${req.file.filename}` : '';
    const attachmentName = req.file ? String(req.file.originalname || 'pièce jointe').slice(0, 160) : '';
    const attachmentMime = req.file ? String(req.file.mimetype || 'application/octet-stream').slice(0, 120) : '';
    if (!body && !attachment) return res.status(400).json({ error: 'Message vide' });
    if (replyTo) {
      const rep = db.prepare('SELECT id FROM chat_messages WHERE id = ? AND conversation_id = ? AND deleted_at = \'\'').get(replyTo, conv.id);
      if (!rep) return res.status(400).json({ error: 'Impossible de répondre à ce message' });
    }
    if (req.file) compressChatImage(req.file.path);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const info = db.prepare(`INSERT INTO chat_messages (conversation_id, sender_id, body, attachment, attachment_name, attachment_mime, reply_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(conv.id, req.user.id, body, attachment, attachmentName, attachmentMime, replyTo, now);
    chatTouchLast(conv.id, { id: info.lastInsertRowid, sender_id: req.user.id, body: body || (attachmentMime.startsWith('image/') ? '📷 Photo' : attachmentMime.startsWith('audio/') ? '🎤 Message vocal' : '📎 Fichier'), created_at: now });
    res.json({ id: info.lastInsertRowid, created_at: now });
  };
  if (String(req.headers['content-type'] || '').toLowerCase().includes('multipart/form-data')) {
    chatUpload.single('file')(req, res, finish);
  } else {
    finish(null);
  }
});

app.put('/api/chat/messages/:id', ...CHAT, (req, res) => {
  const m = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Message introuvable' });
  if (m.sender_id !== req.user.id) return res.status(403).json({ error: 'Seul l’auteur peut modifier son message' });
  if (m.deleted_at) return res.status(400).json({ error: 'Message supprimé' });
  const body = String(req.body?.body || '').trim().slice(0, 4000);
  if (!body) return res.status(400).json({ error: 'Message vide' });
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?').run(body, now, m.id);
  res.json({ ok: true, edited_at: now });
});

app.delete('/api/chat/messages/:id', ...CHAT, (req, res) => {
  const m = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Message introuvable' });
  const own = m.sender_id === req.user.id;
  const mem = db.prepare('SELECT * FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(m.conversation_id, req.user.id);
  const mod = mem && ['proprietaire', 'moderateur'].includes(mem.role);
  if (!own && !mod) return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos messages (ou être modérateur)' });
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('UPDATE chat_messages SET deleted_at = ? WHERE id = ?').run(now, m.id);
  db.prepare('DELETE FROM chat_pins WHERE message_id = ?').run(m.id);
  const last = db.prepare('SELECT * FROM chat_messages WHERE conversation_id = ? AND deleted_at = \'\' ORDER BY id DESC LIMIT 1').get(m.conversation_id);
  if (last) {
    const sender = db.prepare('SELECT full_name FROM users WHERE id = ?').get(last.sender_id);
    db.prepare('UPDATE chat_conversations SET last_message_at = ?, last_message_body = ?, last_message_sender = ? WHERE id = ?')
      .run(last.created_at, (last.body || '').slice(0, 140), sender?.full_name || '', m.conversation_id);
  }
  res.json({ ok: true });
});

app.put('/api/chat/messages/:id/pin', ...CHAT, (req, res) => {
  const m = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(req.params.id));
  if (!m || m.deleted_at) return res.status(404).json({ error: 'Message introuvable' });
  const own = m.sender_id === req.user.id;
  const mem = db.prepare('SELECT * FROM chat_members WHERE conversation_id = ? AND user_id = ?').get(m.conversation_id, req.user.id);
  if (!own && !(mem && ['proprietaire', 'moderateur'].includes(mem.role)))
    return res.status(403).json({ error: 'Épinglage réservé à l’auteur ou aux modérateurs' });
  const pin = db.prepare('SELECT 1 FROM chat_pins WHERE conversation_id = ? AND message_id = ?').get(m.conversation_id, m.id);
  if (pin) db.prepare('DELETE FROM chat_pins WHERE conversation_id = ? AND message_id = ?').run(m.conversation_id, m.id);
  else db.prepare('INSERT INTO chat_pins (conversation_id, message_id, pinned_by) VALUES (?, ?, ?)').run(m.conversation_id, m.id, req.user.id);
  res.json({ ok: true, pinned: !pin });
});

// ---------- Inscription sur invitation (lien à usage unique) ----------
const INVITE_ROLES = ['editor', 'viewer', 'admin'];
const todayISO = () => new Date().toISOString().slice(0, 10);

const inviteState = (inv) => {
  if (inv.used) return 'used';
  if (inv.expires_at < todayISO()) return 'expired';
  return 'available';
};

app.get('/api/register/validate', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.json({ valid: false, error: 'Lien incomplet : token manquant.' });
  const inv = db.prepare('SELECT * FROM invites WHERE token = ?').get(token);
  if (!inv) return res.json({ valid: false, error: 'Ce lien d’invitation est invalide.' });
  const state = inviteState(inv);
  if (state === 'used') return res.json({ valid: false, error: 'Ce lien a déjà été utilisé. Demandez un nouveau lien à l’administrateur.' });
  if (state === 'expired') return res.json({ valid: false, error: 'Ce lien a expiré. Demandez un nouveau lien à l’administrateur.' });
  res.json({
    valid: true,
    role: inv.role,
    role_label: ROLE_LABELS[inv.role],
    email: inv.email || '',
    label: inv.label || '',
    expires_at: inv.expires_at
  });
});

app.post('/api/register', registerLimiter, (req, res) => {
  const { token, full_name, email, password } = req.body || {};
  const inv = db.prepare('SELECT * FROM invites WHERE token = ?').get(String(token || ''));
  if (!inv) return res.status(400).json({ error: 'Ce lien d’invitation est invalide.' });
  const state = inviteState(inv);
  if (state === 'used') return res.status(409).json({ error: 'Ce lien a déjà été utilisé.' });
  if (state === 'expired') return res.status(400).json({ error: 'Ce lien a expiré. Demandez un nouveau lien à l’administrateur.' });
  if (!String(full_name || '').trim() || !email || !password)
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  const em = String(email).toLowerCase().trim();
  if (inv.email && inv.email.toLowerCase() !== em)
    return res.status(409).json({ error: `Ce lien est réservé à l’adresse ${inv.email}` });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(em))
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
  const info = db.prepare('INSERT INTO users (email, password_hash, full_name, role, unique_code) VALUES (?, ?, ?, ?, ?)')
    .run(em, bcrypt.hashSync(String(password), 10), String(full_name).trim(), inv.role, newUniqueCode());
  db.prepare('UPDATE invites SET used = 1, used_at = datetime(\'now\') WHERE id = ?').run(inv.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const t = jwt.sign({ id: user.id, email: user.email, role: user.role, jti: crypto.randomBytes(12).toString('hex') }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token: t, user: publicUser(user) });
});

// Gestion des invitations (admin + super admin)
app.get('/api/admin/invites', authRequired, requirePerm('users.view'), (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, u.full_name AS created_by_name, u.role AS created_by_role
    FROM invites i LEFT JOIN users u ON u.id = i.created_by
    ORDER BY i.created_at DESC
  `).all();
  res.json(rows.map((r) => {
    const row = { ...r, state: inviteState(r) };
    if (hiddenSuper(r.created_by_role, req.user.role)) row.created_by_name = '';
    delete row.created_by_role;
    return row;
  }));
});

app.post('/api/admin/invites', authRequired, requirePerm('users.create'), (req, res) => {
  const { email, role, label, days } = req.body || {};
  if (!INVITE_ROLES.includes(role))
    return res.status(400).json({ error: 'Rôle invalide pour une invitation (éditeur, consultation ou administrateur)' });
  const em = email ? String(email).toLowerCase().trim() : null;
  if (em && db.prepare('SELECT id FROM users WHERE email = ?').get(em))
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email — modifiez-le depuis Utilisateurs' });
  const d = Math.min(30, Math.max(1, Number(days) || 7));
  const expires_at = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const token = crypto.randomBytes(24).toString('hex');
  const info = db.prepare(
    'INSERT INTO invites (token, email, role, label, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(token, em, role, String(label || '').trim(), req.user.id, expires_at);
  res.json({ ...db.prepare('SELECT * FROM invites WHERE id = ?').get(info.lastInsertRowid), state: 'available' });
});

app.delete('/api/admin/invites/:id', authRequired, requirePerm('users.delete'), (req, res) => {
  db.prepare('DELETE FROM invites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Point de vente + stock (caissier pour la caisse, admin+ pour la gestion) ----------
const POS = [authRequired, requirePerm('pos.view'), requireModule('pos_enabled', 'Point de vente')];
const POS_ADMIN = [authRequired, requirePerm('pos.manage'), requireModule('pos_enabled', 'Point de vente')];
const PAYMENT_METHODS = ['especes', 'mobile', 'carte', 'virement', 'autre'];
const STOCK_MOVEMENT_TYPES = ['entree', 'sortie', 'ajustement'];
const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const runTx = (fn) => {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* déjà rollbacké */ }
    throw e;
  }
};
const saleStatusOf = (totalItems, returnedItems) =>
  totalItems > 0 && returnedItems >= totalItems ? 'retournee' : returnedItems > 0 ? 'partielle' : 'vendue';
const fetchSale = (id) => {
  const s = db.prepare(`
    SELECT s.*, u.full_name AS cashier_name
    FROM pos_sales s LEFT JOIN users u ON u.id = s.cashier_id
    WHERE s.id = ?
  `).get(id);
  if (!s) return s;
  s.items = db.prepare('SELECT * FROM pos_sale_items WHERE sale_id = ? ORDER BY id').all(id);
  s.returns = db.prepare(`
    SELECT r.*, u.full_name AS created_by_name
    FROM pos_returns r LEFT JOIN users u ON u.id = r.created_by
    WHERE r.sale_id = ? ORDER BY r.created_at DESC, r.id DESC
  `).all(id);
  s.returns.forEach((r) => { r.items = db.prepare('SELECT * FROM pos_return_items WHERE return_id = ?').all(r.id); });
  const totalItems = s.items.reduce((a, i) => a + i.qty, 0);
  const returnedItems = s.items.reduce((a, i) => a + i.returned_qty, 0);
  s.status = saleStatusOf(totalItems, returnedItems);
  return s;
};

// Catégories
app.get('/api/admin/pos/categories', ...POS, (req, res) => {
  res.json(db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM stock_products p WHERE p.category_id = c.id) AS products
    FROM stock_categories c ORDER BY c.name
  `).all());
});

app.post('/api/admin/pos/categories', ...POS_ADMIN, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom de la catégorie requis' });
  try {
    const info = db.prepare('INSERT INTO stock_categories (name) VALUES (?)').run(name);
    res.json(db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Cette catégorie existe déjà' });
  }
});

app.put('/api/admin/pos/categories/:id', ...POS_ADMIN, (req, res) => {
  const ex = db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Catégorie introuvable' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom de la catégorie requis' });
  try {
    db.prepare('UPDATE stock_categories SET name = ? WHERE id = ?').run(name, ex.id);
    res.json(db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(ex.id));
  } catch {
    res.status(409).json({ error: 'Cette catégorie existe déjà' });
  }
});

app.delete('/api/admin/pos/categories/:id', ...POS_ADMIN, (req, res) => {
  const used = db.prepare('SELECT COUNT(*) n FROM stock_products WHERE category_id = ?').get(req.params.id).n;
  if (used > 0) return res.status(409).json({ error: `Impossible : ${used} produit(s) rattaché(s) à cette catégorie.` });
  db.prepare('DELETE FROM stock_categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Produits
app.get('/api/admin/pos/products', ...POS, (req, res) => {
  const { search, category_id, active } = req.query;
  let sql = `
    SELECT p.*, c.name AS category
    FROM stock_products p LEFT JOIN stock_categories c ON c.id = p.category_id
  `;
  const where = [];
  const params = [];
  if (search) { where.push('(p.name LIKE ? OR p.reference LIKE ? OR p.barcode LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category_id) { where.push('p.category_id = ?'); params.push(category_id); }
  if (active === '1') where.push('p.active = 1');
  if (active === '0') where.push('p.active = 0');
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY p.name';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/admin/pos/products', ...POS_ADMIN, (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nom du produit requis' });
  const price = Math.max(0, Number(b.price) || 0);
  const stock = Math.max(0, Math.trunc(Number(b.stock) || 0));
  const cost = b.cost === '' || b.cost == null ? null : Math.max(0, Number(b.cost) || null);
  const barcode = String(b.barcode || '').trim().slice(0, 64);
  try {
    const info = runTx(() => {
      if (barcode && db.prepare('SELECT id FROM stock_products WHERE barcode = ?').get(barcode)) {
        const err = new Error('BARCODE_TAKEN');
        throw err;
      }
      const r = db.prepare(`INSERT INTO stock_products
        (name, reference, description, category_id, price, cost, stock, min_stock, image, active, barcode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        String(b.name).trim().slice(0, 200),
        String(b.reference || '').trim().slice(0, 40),
        String(b.description || '').slice(0, 2000),
        b.category_id || null,
        price,
        cost,
        stock,
        Math.max(0, Math.trunc(Number(b.min_stock) || 0)),
        b.image || '',
        b.active === false || b.active === 0 || b.active === '0' ? 0 : 1,
        barcode
      );
      if (stock > 0) {
        db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, created_by) VALUES (?, ?, ?, ?, ?)')
          .run(r.lastInsertRowid, 'entree', stock, 'Stock initial', req.user.id);
      }
      return r.lastInsertRowid;
    });
    res.json(db.prepare('SELECT * FROM stock_products WHERE id = ?').get(info));
  } catch (e) {
    if (e.message === 'BARCODE_TAKEN' || String(e.message || '').includes('UNIQUE'))
      return res.status(409).json({ error: 'Ce code-barres est déjà attribué à un autre produit' });
    throw e;
  }
});

app.put('/api/admin/pos/products/:id', ...POS_ADMIN, (req, res) => {
  const ex = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Produit introuvable' });
  const b = { ...ex, ...req.body };
  const nextStock = Math.max(0, Math.trunc(Number(b.stock) || 0));
  const cost = b.cost === '' || b.cost == null ? null : Math.max(0, Number(b.cost) || null);
  const barcode = String(b.barcode || '').trim().slice(0, 64);
  try {
    runTx(() => {
      if (barcode && db.prepare('SELECT id FROM stock_products WHERE barcode = ? AND id != ?').get(barcode, ex.id)) {
        throw new Error('BARCODE_TAKEN');
      }
      db.prepare(`UPDATE stock_products SET
        name = ?, reference = ?, description = ?, category_id = ?, price = ?, cost = ?, stock = ?, min_stock = ?, image = ?, active = ?, barcode = ?
        WHERE id = ?`).run(
        String(b.name).trim().slice(0, 200),
        String(b.reference || '').trim().slice(0, 40),
        String(b.description || '').slice(0, 2000),
        b.category_id || null,
        Math.max(0, Number(b.price) || 0),
        cost,
        nextStock,
        Math.max(0, Math.trunc(Number(b.min_stock) || 0)),
        b.image || '',
        b.active === false || b.active === 0 || b.active === '0' ? 0 : 1,
        barcode,
        ex.id
      );
      if (nextStock !== ex.stock) {
        db.prepare('INSERT INTO stock_movements (product_id, type, qty, new_stock, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)')
          .run(ex.id, 'ajustement', Math.abs(nextStock - ex.stock), nextStock, 'Mise à jour du stock depuis la fiche produit', req.user.id);
      }
    });
    res.json(db.prepare('SELECT * FROM stock_products WHERE id = ?').get(ex.id));
  } catch (e) {
    if (e.message === 'BARCODE_TAKEN' || String(e.message || '').includes('UNIQUE'))
      return res.status(409).json({ error: 'Ce code-barres est déjà attribué à un autre produit' });
    throw e;
  }
});

app.get('/api/admin/pos/products/by-barcode/:code', ...POS, (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!code) return res.status(404).json({ error: 'Code-barres vide' });
  const p = db.prepare(`
    SELECT p.*, c.name AS category
    FROM stock_products p LEFT JOIN stock_categories c ON c.id = p.category_id
    WHERE p.barcode = ?
  `).get(code);
  if (!p) return res.status(404).json({ error: 'Aucun produit ne correspond à ce code-barres' });
  res.json(p);
});

app.get('/api/admin/pos/products/:id', ...POS, (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name AS category
    FROM stock_products p LEFT JOIN stock_categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  p.movements = db.prepare(`
    SELECT m.*, u.full_name AS created_by_name
    FROM stock_movements m LEFT JOIN users u ON u.id = m.created_by
    WHERE m.product_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 30
  `).all(p.id);
  res.json(p);
});

app.delete('/api/admin/pos/products/:id', ...POS_ADMIN, (req, res) => {
  const used = db.prepare('SELECT COUNT(*) n FROM pos_sale_items WHERE product_id = ?').get(req.params.id).n;
  if (used > 0) return res.status(409).json({ error: 'Impossible : ce produit apparaît dans des ventes. Désactivez-le plutôt.' });
  db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM stock_products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Mouvements de stock
app.get('/api/admin/pos/movements', ...POS, (req, res) => {
  const { product_id, type } = req.query;
  let sql = `
    SELECT m.*, p.name AS product_name, u.full_name AS created_by_name
    FROM stock_movements m
    JOIN stock_products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.created_by
  `;
  const where = [];
  const params = [];
  if (product_id) { where.push('m.product_id = ?'); params.push(product_id); }
  if (type) { where.push('m.type = ?'); params.push(type); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY m.created_at DESC, m.id DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/admin/pos/products/:id/movements', ...POS, (req, res) => {
  const p = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  const b = req.body || {};
  const type = STOCK_MOVEMENT_TYPES.includes(b.type) ? b.type : 'entree';
  const reason = String(b.reason || '').slice(0, 300);
  let qty = 0;
  let newStock = null;
  if (type === 'entree' || type === 'sortie') {
    qty = Math.trunc(Number(b.qty) || 0);
    if (qty <= 0) return res.status(400).json({ error: 'Quantité positive requise' });
    if (type === 'sortie' && qty > p.stock)
      return res.status(400).json({ error: `Stock insuffisant : ${p.stock} unité(s) disponible(s).` });
  } else {
    newStock = Math.trunc(Number(b.new_stock));
    if (Number.isNaN(newStock) || newStock < 0)
      return res.status(400).json({ error: 'Nouveau stock requis (0 ou plus)' });
  }
  const nextStock = type === 'entree' ? p.stock + qty : type === 'sortie' ? p.stock - qty : newStock;
  runTx(() => {
    db.prepare('UPDATE stock_products SET stock = ? WHERE id = ?').run(nextStock, p.id);
    db.prepare('INSERT INTO stock_movements (product_id, type, qty, new_stock, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(p.id, type, type === 'ajustement' ? Math.abs(newStock - p.stock) : qty, type === 'ajustement' ? newStock : null, reason, req.user.id);
  });
  res.json({ ok: true, stock: nextStock });
});

// Ventes
app.post('/api/admin/pos/sales', ...POS, requirePerm('pos.sell'), (req, res) => {
  const b = req.body || {};
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((i) => ({ product_id: Number(i?.product_id) || 0, qty: Math.trunc(Number(i?.qty) || 0) }))
    .filter((i) => i.product_id > 0 && i.qty > 0);
  if (!items.length) return res.status(400).json({ error: 'Panier vide' });
  const payment = PAYMENT_METHODS.includes(b.payment_method) ? b.payment_method : 'especes';
  const discount = Math.max(0, Number(b.discount) || 0);
  const paid = Math.max(0, Number(b.paid_amount) || 0);

  const lines = [];
  const need = new Map();
  for (const it of items) {
    const p = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(it.product_id);
    if (!p || !p.active) return res.status(404).json({ error: 'Un produit du panier est introuvable ou inactif.' });
    lines.push({ p, qty: it.qty });
    need.set(p.id, (need.get(p.id) || 0) + it.qty);
  }
  for (const [pid, n] of need) {
    const p = db.prepare('SELECT name, stock FROM stock_products WHERE id = ?').get(pid);
    if (n > p.stock)
      return res.status(409).json({ error: `Stock insuffisant pour « ${p.name} » : ${p.stock} disponible(s), ${n} demandé(s).` });
  }
  let subtotal = 0;
  for (const { p, qty } of lines) subtotal = money2(subtotal + p.price * qty);
  if (discount > subtotal) return res.status(400).json({ error: 'La réduction ne peut pas dépasser le sous-total.' });
  const total = money2(subtotal - discount);

  const sid = runTx(() => {
    const info = db.prepare(`INSERT INTO pos_sales
      (number, customer_name, subtotal, discount, total, payment_method, paid_amount, cashier_id, notes)
      VALUES ('', ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      String(b.customer_name || '').trim().slice(0, 120),
      subtotal, money2(discount), total, payment,
      payment === 'especes' ? Math.max(paid, total) : total,
      req.user.id,
      String(b.notes || '').slice(0, 500)
    );
    const id = info.lastInsertRowid;
    const number = `POS-${String(id).padStart(5, '0')}`;
    const insItem = db.prepare('INSERT INTO pos_sale_items (sale_id, product_id, product_name, price, qty, total) VALUES (?, ?, ?, ?, ?, ?)');
    const decStock = db.prepare('UPDATE stock_products SET stock = stock - ? WHERE id = ?');
    const insMove = db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, created_by) VALUES (?, ?, ?, ?, ?)');
    for (const { p, qty } of lines) {
      insItem.run(id, p.id, p.name, p.price, qty, money2(p.price * qty));
      decStock.run(qty, p.id);
      insMove.run(p.id, 'sortie', qty, `Vente ${number}`, req.user.id);
    }
    db.prepare('UPDATE pos_sales SET number = ? WHERE id = ?').run(number, id);
    return id;
  });
  res.json(fetchSale(sid));
});

app.get('/api/admin/pos/sales', ...POS, (req, res) => {
  const { from, to, payment, q } = req.query;
  let sql = `
    SELECT s.*, u.full_name AS cashier_name,
      (SELECT COALESCE(SUM(qty), 0) FROM pos_sale_items WHERE sale_id = s.id) AS total_items,
      (SELECT COALESCE(SUM(returned_qty), 0) FROM pos_sale_items WHERE sale_id = s.id) AS returned_items,
      (SELECT COUNT(*) FROM pos_sale_items WHERE sale_id = s.id) AS items_count
    FROM pos_sales s LEFT JOIN users u ON u.id = s.cashier_id
  `;
  const where = [];
  const params = [];
  if (from) { where.push('date(s.created_at) >= date(?)'); params.push(String(from).slice(0, 10)); }
  if (to) { where.push('date(s.created_at) <= date(?)'); params.push(String(to).slice(0, 10)); }
  if (payment) { where.push('s.payment_method = ?'); params.push(payment); }
  if (q) { where.push('(s.number LIKE ? OR s.customer_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY s.created_at DESC, s.id DESC LIMIT 200';
  const rows = db.prepare(sql).all(...params);
  rows.forEach((r) => { r.status = saleStatusOf(r.total_items, r.returned_items); });
  res.json(rows);
});

app.get('/api/admin/pos/sales/:id', ...POS, (req, res) => {
  const s = fetchSale(req.params.id);
  if (!s) return res.status(404).json({ error: 'Vente introuvable' });
  res.json(s);
});

// Retours (totaux ou partiels) — réapprovisionne le stock
app.post('/api/admin/pos/sales/:id/return', ...POS_ADMIN, (req, res) => {
  const s = fetchSale(req.params.id);
  if (!s) return res.status(404).json({ error: 'Vente introuvable' });
  if (s.status === 'retournee') return res.status(409).json({ error: 'Cette vente est déjà intégralement retournée.' });
  const b = req.body || {};
  const reqs = (Array.isArray(b.items) ? b.items : [])
    .map((i) => ({ item_id: Number(i?.item_id) || 0, qty: Math.trunc(Number(i?.qty) || 0) }))
    .filter((i) => i.item_id > 0 && i.qty > 0);
  if (!reqs.length) return res.status(400).json({ error: 'Aucun article à retourner' });
  const byItem = new Map(s.items.map((i) => [i.id, i]));
  const perItem = new Map();
  for (const r of reqs) {
    const item = byItem.get(r.item_id);
    if (!item) return res.status(404).json({ error: 'Ligne de vente introuvable' });
    perItem.set(r.item_id, (perItem.get(r.item_id) || 0) + r.qty);
  }
  let total = 0;
  for (const [item_id, qty] of perItem) {
    const item = byItem.get(item_id);
    const remaining = item.qty - item.returned_qty;
    if (qty > remaining)
      return res.status(400).json({ error: `Retour excessif pour « ${item.product_name} » : ${remaining} unité(s) retournable(s).` });
    total = money2(total + item.price * qty);
  }
  runTx(() => {
    const info = db.prepare('INSERT INTO pos_returns (sale_id, reason, total, created_by) VALUES (?, ?, ?, ?)')
      .run(s.id, String(b.reason || '').slice(0, 300), total, req.user.id);
    const rid = info.lastInsertRowid;
    const insRi = db.prepare('INSERT INTO pos_return_items (return_id, sale_item_id, product_id, qty) VALUES (?, ?, ?, ?)');
    const updItem = db.prepare('UPDATE pos_sale_items SET returned_qty = returned_qty + ? WHERE id = ?');
    const updStock = db.prepare('UPDATE stock_products SET stock = stock + ? WHERE id = ?');
    const insMove = db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, created_by) VALUES (?, ?, ?, ?, ?)');
    for (const [item_id, qty] of perItem) {
      const item = byItem.get(item_id);
      insRi.run(rid, item.id, item.product_id, qty);
      updItem.run(qty, item.id);
      if (item.product_id) {
        updStock.run(qty, item.product_id);
        insMove.run(item.product_id, 'entree', qty, `Retour ${s.number}`, req.user.id);
      }
    }
  });
  res.json(fetchSale(s.id));
});

// Annulation (void) : supprime la vente et réapprovisionne le stock non retourné
app.delete('/api/admin/pos/sales/:id', ...POS_ADMIN, (req, res) => {
  const s = fetchSale(req.params.id);
  if (!s) return res.status(404).json({ error: 'Vente introuvable' });
  runTx(() => {
    const updStock = db.prepare('UPDATE stock_products SET stock = stock + ? WHERE id = ?');
    const insMove = db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, created_by) VALUES (?, ?, ?, ?, ?)');
    for (const it of s.items) {
      const toRestock = it.qty - it.returned_qty;
      if (toRestock > 0 && it.product_id) {
        updStock.run(toRestock, it.product_id);
        insMove.run(it.product_id, 'entree', toRestock, `Annulation ${s.number}`, req.user.id);
      }
    }
    const retIds = s.returns.map((r) => r.id);
    if (retIds.length) {
      const ph = retIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM pos_return_items WHERE return_id IN (${ph})`).run(...retIds);
      db.prepare(`DELETE FROM pos_returns WHERE id IN (${ph})`).run(...retIds);
    }
    db.prepare('DELETE FROM pos_sale_items WHERE sale_id = ?').run(s.id);
    db.prepare('DELETE FROM pos_sales WHERE id = ?').run(s.id);
  });
  res.json({ ok: true });
});

// Ticket PDF (A5)
app.get('/api/admin/pos/sales/:id/pdf', ...POS, async (req, res) => {
  const s = fetchSale(req.params.id);
  if (!s) return res.status(404).json({ error: 'Vente introuvable' });
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([420.5, 595.3]);
    const W = 420.5;
    const [font, fontBold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold)
    ]);
    const brand = rgb(0.059, 0.227, 0.533);
    const ink = rgb(0.1, 0.12, 0.18);
    const gray = rgb(0.45, 0.5, 0.58);
    const siteName = getSetting('site_name') || 'ADI ONG';
    const tagline = getSetting('site_tagline') || '';
    const fmtM = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/[\u202f\u00a0\u2009]/g, ' ');

    page.drawRectangle({ x: 0, y: 595.3 - 70, width: W, height: 70, color: brand });
    page.drawText(siteName.toUpperCase(), { x: 30, y: 548, size: 15, font: fontBold, color: rgb(1, 1, 1) });
    if (tagline) page.drawText(String(tagline).slice(0, 72), { x: 30, y: 532, size: 7.5, font, color: rgb(0.85, 0.89, 0.95) });

    let y = 506;
    const row = (label, val, bold = false, size = 9.5) => {
      page.drawText(label, { x: 30, y, size, font: bold ? fontBold : font, color: bold ? ink : gray });
      page.drawText(val, { x: W - 30 - font.widthOfTextAtSize(val, size), y, size, font: bold ? fontBold : font, color: ink });
      y -= 15;
    };
    row('Ticket', s.number || '—', true);
    const dt = new Date(String(s.created_at).replace(' ', 'T') + 'Z');
    if (!isNaN(dt)) {
      row('Date', `${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })} ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`);
    }
    if (s.cashier_name) row('Caissier', s.cashier_name);
    if (s.customer_name) row('Client', s.customer_name);
    y -= 6;
    page.drawLine({ start: { x: 30, y }, end: { x: W - 30, y }, thickness: 0.7, color: rgb(0.8, 0.83, 0.88) });
    y -= 16;
    const barcodes = new Map(db.prepare('SELECT id, barcode FROM stock_products').all().map((r) => [r.id, r.barcode]));
    for (const it of s.items) {
      page.drawText(`${it.qty} × ${it.product_name}`.slice(0, 48), { x: 30, y, size: 9, font, color: ink });
      const val = fmtM(it.total);
      page.drawText(val, { x: W - 30 - font.widthOfTextAtSize(val, 9), y, size: 9, font, color: ink });
      y -= 13;
      const bc = barcodes.get(it.product_id);
      if (bc) {
        page.drawText(`CB ${bc}`, { x: 30, y, size: 7.5, font, color: gray });
        y -= 12;
      }
      if (it.returned_qty > 0) {
        page.drawText(`dont ${it.returned_qty} retourné(s)`, { x: 30, y, size: 7.5, font, color: gray });
        y -= 12;
      }
    }
    if (y < 150) y = 150;
    y -= 4;
    page.drawLine({ start: { x: 30, y }, end: { x: W - 30, y }, thickness: 0.7, color: rgb(0.8, 0.83, 0.88) });
    y -= 16;
    row('Sous-total', fmtM(s.subtotal));
    if (s.discount > 0) row('Réduction', `-${fmtM(s.discount)}`);
    row('TOTAL', `${fmtM(s.total)} USD`, true, 12);
    y -= 3;
    const PM = { especes: 'Espèces', mobile: 'Mobile Money', carte: 'Carte bancaire', virement: 'Virement', autre: 'Autre' };
    row('Paiement', PM[s.payment_method] || s.payment_method);
    if (s.payment_method === 'especes' && s.paid_amount > s.total) row('Monnaie rendue', fmtM(s.paid_amount - s.total));
    if (s.status !== 'vendue') row('Retours', s.status === 'retournee' ? 'Vente intégralement retournée' : 'Retour partiel effectué');

    page.drawText('Merci de votre confiance !', { x: (W - fontBold.widthOfTextAtSize('Merci de votre confiance !', 10)) / 2, y: 56, size: 10, font: fontBold, color: ink });
    const footer = [getSetting('address'), getSetting('phone1')].filter(Boolean).join('  ·  ');
    if (footer) page.drawText(footer.slice(0, 90), { x: (W - font.widthOfTextAtSize(footer.slice(0, 90), 7)) / 2, y: 42, size: 7, font, color: gray });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${s.number || `ticket-${s.id}`}.pdf"`);
    res.send(Buffer.from(await doc.save()));
  } catch {
    res.status(500).json({ error: 'Impossible de générer le PDF' });
  }
});

// Statistiques
app.get('/api/admin/pos/stats', ...POS_ADMIN, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const t = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(total), 0) total FROM pos_sales WHERE date(created_at) = ?').get(today);
  const byPayment = db.prepare(
    'SELECT payment_method, COUNT(*) n, COALESCE(SUM(total), 0) total FROM pos_sales WHERE date(created_at) = ? GROUP BY payment_method'
  ).all(today);
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const r = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(total), 0) total FROM pos_sales WHERE date(created_at) = ?').get(d);
    last7.push({ date: d, n: r.n, total: r.total });
  }
  const topProducts = db.prepare(`
    SELECT COALESCE(p.name, i.product_name) AS name, COALESCE(SUM(i.qty), 0) AS qty, COALESCE(SUM(i.total), 0) AS total
    FROM pos_sale_items i
    JOIN pos_sales s ON s.id = i.sale_id
    LEFT JOIN stock_products p ON p.id = i.product_id
    WHERE date(s.created_at) >= date('now', '-30 days')
    GROUP BY i.product_id ORDER BY qty DESC LIMIT 5
  `).all();
  const lowStock = db.prepare(`
    SELECT id, name, stock, min_stock FROM stock_products
    WHERE active = 1 AND stock <= min_stock
    ORDER BY stock ASC, name LIMIT 15
  `).all();
  const stockValue = db.prepare('SELECT COALESCE(SUM(stock * COALESCE(cost, price)), 0) v FROM stock_products WHERE active = 1').get().v;
  const products = db.prepare('SELECT COUNT(*) n FROM stock_products WHERE active = 1').get().n;
  const outOfStock = db.prepare('SELECT COUNT(*) n FROM stock_products WHERE active = 1 AND stock = 0').get().n;
  res.json({ today: { n: t.n, total: t.total }, byPayment, last7, topProducts, lowStock, stockValue, products, outOfStock });
});

// Rapport de caisse journalier
app.get('/api/admin/pos/reports/daily', ...POS_ADMIN, (req, res) => {
  const date = String(req.query.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Date invalide (format AAAA-MM-JJ)' });
  const sales = db.prepare('SELECT * FROM pos_sales WHERE date(created_at) = ?').all(date);
  const returns = db.prepare('SELECT * FROM pos_returns WHERE date(created_at) = ?').all(date);
  const gross = money2(sales.reduce((a, s) => a + s.total, 0));
  const subGross = money2(sales.reduce((a, s) => a + s.subtotal, 0));
  const discounts = money2(sales.reduce((a, s) => a + s.discount, 0));
  const returnsTotal = money2(returns.reduce((a, r) => a + r.total, 0));
  const byPayment = {};
  for (const s of sales) {
    if (!byPayment[s.payment_method]) byPayment[s.payment_method] = { n: 0, total: 0 };
    byPayment[s.payment_method].n += 1;
    byPayment[s.payment_method].total = money2(byPayment[s.payment_method].total + s.total);
  }
  const topProducts = db.prepare(`
    SELECT COALESCE(p.name, i.product_name) AS name, COALESCE(SUM(i.qty), 0) AS qty, COALESCE(SUM(i.total), 0) AS total
    FROM pos_sale_items i
    JOIN pos_sales s ON s.id = i.sale_id
    LEFT JOIN stock_products p ON p.id = i.product_id
    WHERE date(s.created_at) = ?
    GROUP BY i.product_id ORDER BY qty DESC LIMIT 5
  `).all(date);
  const voidNumbers = new Set(
    db.prepare("SELECT reason FROM stock_movements WHERE date(created_at) = ? AND reason LIKE 'Annulation %'")
      .all(date)
      .map((r) => r.reason.replace(/^Annulation\s+/, ''))
      .filter(Boolean)
  );
  res.json({
    date,
    n: sales.length,
    gross,
    subGross,
    discounts,
    returnsTotal,
    net: money2(gross - returnsTotal),
    voidCount: voidNumbers.size,
    avg: sales.length ? money2(gross / sales.length) : 0,
    byPayment,
    topProducts
  });
});

// Facture client (PDF A4)
app.get('/api/admin/pos/sales/:id/invoice', ...POS, async (req, res) => {
  const s = fetchSale(req.params.id);
  if (!s) return res.status(404).json({ error: 'Vente introuvable' });
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const W = 595.28;
    const [font, fontBold] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold)
    ]);
    const brand = rgb(0.059, 0.227, 0.533);
    const ink = rgb(0.1, 0.12, 0.18);
    const gray = rgb(0.45, 0.5, 0.58);
    const siteName = getSetting('site_name') || 'ADI ONG';
    const tagline = getSetting('site_tagline') || '';
    const fmtM = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/[\u202f\u00a0\u2009]/g, ' ');
    const dt = new Date(String(s.created_at).replace(' ', 'T') + 'Z');
    const dateStr = isNaN(dt) ? s.created_at : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

    page.drawRectangle({ x: 0, y: 841.89 - 88, width: W, height: 88, color: brand });
    page.drawText(siteName.toUpperCase(), { x: 40, y: 782, size: 18, font: fontBold, color: rgb(1, 1, 1) });
    if (tagline) page.drawText(tagline, { x: 40, y: 764, size: 9, font, color: rgb(0.85, 0.89, 0.95) });

    page.drawText('FACTURE', { x: 40, y: 716, size: 24, font: fontBold, color: ink });
    const numStr = `N° ${s.number}`;
    page.drawText(numStr, { x: W - 40 - fontBold.widthOfTextAtSize(numStr, 14), y: 720, size: 14, font: fontBold, color: brand });

    const box = (x, y, w, h) => page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.82, 0.85, 0.9), borderWidth: 1 });
    box(40, 596, 240, 86);
    box(315, 596, 240, 86);
    page.drawText('ORGANISATION', { x: 50, y: 666, size: 8, font: fontBold, color: gray });
    page.drawText(siteName, { x: 50, y: 650, size: 10, font: fontBold, color: ink });
    let ly = 634;
    for (const line of [getSetting('address'), getSetting('phone1'), getSetting('email')].filter(Boolean)) {
      page.drawText(String(line).slice(0, 60), { x: 50, y: ly, size: 9, font, color: ink });
      ly -= 14;
    }
    page.drawText('FACTURÉ À', { x: 325, y: 666, size: 8, font: fontBold, color: gray });
    page.drawText(s.customer_name || 'Client de comptoir', { x: 325, y: 650, size: 10, font: fontBold, color: ink });
    page.drawText(`Facturé le ${dateStr}`, { x: 325, y: 632, size: 9, font, color: gray });
    if (s.cashier_name) page.drawText(`Caissier : ${s.cashier_name}`, { x: 325, y: 618, size: 9, font, color: gray });

    let y = 556;
    page.drawText('ARTICLE', { x: 40, y, size: 8, font: fontBold, color: gray });
    page.drawText('PRIX U', { x: 380, y, size: 8, font: fontBold, color: gray });
    page.drawText('QTÉ', { x: 460, y, size: 8, font: fontBold, color: gray });
    page.drawText('TOTAL', { x: 500, y, size: 8, font: fontBold, color: gray });
    y -= 6;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.7, color: rgb(0.75, 0.78, 0.84) });
    y -= 16;
    const wrap = (text, size, maxWidth) => {
      const words = String(text).split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };
    for (const it of s.items) {
      const lineTop = y;
      for (const line of wrap(it.product_name, 10, 320)) {
        page.drawText(line, { x: 40, y, size: 10, font, color: ink });
        y -= 13;
      }
      if (it.returned_qty > 0) {
        page.drawText(`dont ${it.returned_qty} retourné(s)`, { x: 40, y, size: 8, font, color: gray });
        y -= 12;
      }
      const pU = fmtM(it.price);
      page.drawText(pU, { x: 380 + 60 - font.widthOfTextAtSize(pU, 10), y: lineTop, size: 10, font, color: ink });
      const q = String(it.qty);
      page.drawText(q, { x: 460 + 20 - font.widthOfTextAtSize(q, 10), y: lineTop, size: 10, font, color: ink });
      const t = fmtM(it.total);
      page.drawText(t, { x: 555 - font.widthOfTextAtSize(t, 10), y: lineTop, size: 10, font: fontBold, color: ink });
      y -= 8;
      page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.4, color: rgb(0.88, 0.9, 0.93) });
      y -= 16;
    }

    const row = (label, val, bold = false) => {
      page.drawText(label, { x: 365, y, size: bold ? 10 : 9.5, font: bold ? fontBold : font, color: bold ? ink : gray });
      page.drawText(val, { x: 555 - font.widthOfTextAtSize(val, bold ? 10 : 9.5), y, size: bold ? 10 : 9.5, font: bold ? fontBold : font, color: ink });
      y -= 16;
    };
    row('Sous-total', fmtM(s.subtotal));
    if (s.discount > 0) row('Réduction', `-${fmtM(s.discount)}`);
    y -= 2;
    page.drawRectangle({ x: 350, y: y - 6, width: 205, height: 30, color: brand });
    page.drawText('TOTAL À PAYER', { x: 362, y: y + 4, size: 9, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(`${fmtM(s.total)} USD`, { x: 555 - fontBold.widthOfTextAtSize(`${fmtM(s.total)} USD`, 11), y: y + 3, size: 11, font: fontBold, color: rgb(1, 1, 1) });
    y -= 34;
    const PM = { especes: 'Espèces', mobile: 'Mobile Money', carte: 'Carte bancaire', virement: 'Virement', autre: 'Autre' };
    page.drawText(`Mode de paiement : ${PM[s.payment_method] || s.payment_method}`, { x: 40, y, size: 9.5, font, color: gray });
    if (s.status !== 'vendue') {
      page.drawText(s.status === 'retournee' ? 'Attention : vente intégralement retournée.' : 'Attention : retour partiel effectué sur cette facture.', { x: 40, y: y - 14, size: 9, font: fontBold, color: rgb(0.78, 0.2, 0.2) });
    }

    page.drawText('Merci de votre confiance !', { x: (W - fontBold.widthOfTextAtSize('Merci de votre confiance !', 10)) / 2, y: 60, size: 10, font: fontBold, color: ink });
    const footer = [getSetting('address'), getSetting('phone1'), getSetting('email')].filter(Boolean).join('  ·  ');
    if (footer) page.drawText(footer.slice(0, 100), { x: (W - font.widthOfTextAtSize(footer.slice(0, 100), 7.5)) / 2, y: 45, size: 7.5, font, color: gray });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${s.number || s.id}.pdf"`);
    res.send(Buffer.from(await doc.save()));
  } catch (err) {
    console.error('[facture]', err);
    res.status(500).json({ error: 'Impossible de générer la facture' });
  }
});

// ---------- Boutique en ligne (commandes publiques) + suivi admin ----------
const SHOP_METHODS = ['mobile', 'especes'];
const nextShopRef = () => {
  const row = db.prepare(`SELECT id FROM shop_orders ORDER BY id DESC LIMIT 1`).get();
  return 'OR-' + String((row ? row.id : 0) + 1).padStart(5, '0');
};
const parseShopItems = (raw) => {
  const items = Array.isArray(raw) ? raw : [];
  if (items.length === 0) return { error: 'Panier vide' };
  if (items.length > 50) return { error: 'Trop de lignes de commande (50 maximum)' };
  const byId = new Map();
  for (const it of items) {
    const qty = Math.trunc(Number(it?.qty) || 0);
    const product_id = Number(it?.product_id) || 0;
    if (!product_id || qty <= 0 || qty > 200) return { error: 'Quantités invalides (1 à 200 par ligne)' };
    byId.set(product_id, (byId.get(product_id) || 0) + qty);
  }
  const clean = [];
  for (const [product_id, qty] of byId) {
    if (qty > 200) return { error: 'Quantités invalides (1 à 200 par produit)' };
    clean.push({ product_id, qty });
  }
  return { items: clean };
};

app.get('/api/public/shop', (req, res) => {
  if (getSetting('pos_enabled') !== '1') return res.status(403).json({ error: 'La boutique en ligne est actuellement fermée.' });
  const categories = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM stock_products p WHERE p.category_id = c.id AND p.active = 1 AND p.stock > 0) AS products
    FROM stock_categories c
  `).all();
  const products = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.stock, p.image, p.barcode, p.category_id, c.name AS category
    FROM stock_products p LEFT JOIN stock_categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.stock > 0
    ORDER BY c.name IS NULL, c.name, p.name
  `).all();
  res.json({ categories, products });
});

app.post('/api/public/shop/orders', (req, res) => {
  if (getSetting('pos_enabled') !== '1') return res.status(403).json({ error: 'La boutique en ligne est actuellement fermée.' });
  const b = req.body || {};
  const customer_name = String(b.customer_name || '').trim().slice(0, 120);
  const phone = String(b.phone || '').trim().slice(0, 40);
  const note = String(b.note || '').trim().slice(0, 500);
  const payment_method = SHOP_METHODS.includes(b.payment_method) ? b.payment_method : 'mobile';
  if (!customer_name) return res.status(400).json({ error: 'Votre nom est requis' });
  if (!phone) return res.status(400).json({ error: 'Un numéro de téléphone est requis' });
  const parsed = parseShopItems(b.items);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const order = runTx(() => {
      let subtotal = 0;
      const lines = [];
      for (const it of parsed.items) {
        const p = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(it.product_id);
        if (!p || !p.active) return { fail: 404, msg: 'Un produit du panier n\'est plus disponible.' };
        if (p.stock < it.qty) {
          return {
            fail: 409,
            msg: `Stock insuffisant pour « ${p.name} » : ${p.stock} disponible(s), ${it.qty} demandé(s).`
          };
        }
        const lineTotal = money2(p.price * it.qty);
        subtotal += lineTotal;
        lines.push({
          product_id: p.id, product_name: p.name, qty: it.qty, price: p.price, total: lineTotal
        });
      }
      subtotal = money2(subtotal);
      const reference = nextShopRef();
      const r = db.prepare(`INSERT INTO shop_orders
        (reference, customer_name, phone, note, items, subtotal, total, payment_method, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'attente')`).run(
        reference, customer_name, phone, note, JSON.stringify(lines), subtotal, subtotal, payment_method
      );
      for (const line of lines) {
        const p = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(line.product_id);
        const nextStock = p.stock - line.qty;
        db.prepare('UPDATE stock_products SET stock = ? WHERE id = ?').run(nextStock, p.id);
        db.prepare('INSERT INTO stock_movements (product_id, type, qty, new_stock, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)')
          .run(p.id, 'sortie', line.qty, nextStock, `Commande en ligne ${reference}`, null);
      }
      return db.prepare('SELECT * FROM shop_orders WHERE id = ?').get(r.lastInsertRowid);
    });
    if (order && order.fail) return res.status(order.fail).json({ error: order.msg });
    const full = db.prepare('SELECT * FROM shop_orders WHERE id = ?').get(order.id);
    full.items = JSON.parse(full.items || '[]');
    res.status(201).json(full);
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* déjà rollbacké */ }
    return res.status(500).json({ error: 'Impossible d’enregistrer la commande' });
  }
});

app.get('/api/admin/pos/orders', ...POS, (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM shop_orders';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  rows.forEach((o) => { o.items = JSON.parse(o.items || '[]'); });
  res.json(rows);
});

app.patch('/api/admin/pos/orders/:id', ...POS, (req, res) => {
  const o = db.prepare('SELECT * FROM shop_orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Commande introuvable' });
  const status = (req.body || {}).status;
  const ALLOWED = ['attente', 'preparation', 'livree', 'annulee'];
  if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  if (status === o.status) return res.json({ ...o, items: JSON.parse(o.items || '[]') });
  if ((status === 'annulee') && o.status !== 'attente')
    return res.status(409).json({ error: 'Seule une commande en attente peut être annulée.' });
  const lines = JSON.parse(o.items || '[]');
  runTx(() => {
    if (status === 'annulee') {
      const restore = new Map();
      for (const it of lines) {
        const pid = Number(it.product_id) || 0;
        const qty = Math.trunc(Number(it.qty) || 0);
        if (!pid || qty <= 0) continue;
        restore.set(pid, (restore.get(pid) || 0) + qty);
      }
      for (const [pid, qty] of restore) {
        const p = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(pid);
        if (!p) continue;
        const nextStock = p.stock + qty;
        db.prepare('UPDATE stock_products SET stock = ? WHERE id = ?').run(nextStock, p.id);
        db.prepare('INSERT INTO stock_movements (product_id, type, qty, new_stock, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)')
          .run(p.id, 'entree', qty, nextStock, `Commande en ligne annulée ${o.reference}`, req.user.id);
      }
    }
    db.prepare(`UPDATE shop_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, o.id);
  });
  const up = db.prepare('SELECT * FROM shop_orders WHERE id = ?').get(o.id);
  res.json({ ...up, items: lines });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1d' }));
  app.get(/^(?!\/(api|uploads)\/)(?!\/(sitemap\.xml|robots\.txt|rss\.xml)$).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error('[erreur]', err);
  res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : err.message || 'Erreur' });
});

// Passenger (N0C / CloudLinux) : PORT=passenger — sinon écoute TCP classique
if (process.env.PORT === 'passenger' || process.env.PASSENGER_APP_ENV) {
  app.listen('passenger', () => console.log('🚀 API ADI ONG (Passenger)'));
} else {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API ADI ONG sur http://0.0.0.0:${PORT}`));
}
