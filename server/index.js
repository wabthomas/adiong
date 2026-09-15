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

ensureSettings();
seedIfEmpty();
ensureUserCodes();
await syncMediaLibrary();

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
app.use(cors({
  origin: (origin, cb) => cb(null, !origin),
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
const donateLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `donate:${req.ip}`, message: 'Trop de dons enregistrés depuis votre connexion. Réessayez dans une heure.' });
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

const STRING_SETTINGS = [
  'grh_annual_leave_days',
  'site_name','site_tagline','logo','favicon','address','phone1','phone2','email','whatsapp','facebook','twitter',
  'instagram','pinterest','video_url','copyright',
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
  'about_career_title','about_career_text'
];

const JSON_SETTINGS = {
  stats: [], values: [], method: [],
  marquee_items: [], donate_amounts: [], donate_why_points: [], campaign_points: [],
  about_header: {}, work_header: {}, news_header: {}, campaigns_header: {}, donate_header: {}, contact_header: {}
};

const parseSetting = (raw, fallback) => {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

export const publicSite = () => {
  const out = {};
  for (const k of STRING_SETTINGS) out[k] = getSetting(k);
  for (const [k, fallback] of Object.entries(JSON_SETTINGS)) out[k] = parseSetting(getSetting(k), fallback);
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
  any: ['super_admin', 'admin', 'editor', 'viewer']
};
const requireRole = (group) => (req, res, next) => {
  if (!ROLES[group].includes(req.user?.role))
    return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
  next();
};
// Garde d'un module optionnel (activé/désactivé par le super admin)
const requireModule = (name, label) => (req, res, next) => {
  if (getSetting(name) !== '1')
    return res.status(403).json({ error: `Module ${label} désactivé par le super administrateur.` });
  next();
};

const uniqueSlug = (table, desired, ignoreId = null) => {
  let slug = desired;
  let i = 1;
  const check = ignoreId
    ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`)
    : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  while ((ignoreId ? check.get(slug, ignoreId) : check.get(slug))) slug = `${desired}-${++i}`;
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
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

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
    role_label: u.role_label,
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

app.post('/api/donate', donateLimiter, (req, res) => {
  const b = req.body || {};
  if (isSpam(b)) return res.json({ ok: true });
  const name = clip(b.name, 100).trim();
  const email = clip(b.email, 120).trim();
  const amount = Number(b.amount);
  const message = clip(b.message, 500).trim();
  const campaignId = b.campaignId ? Number(b.campaignId) : null;
  if (!name || !amount || amount <= 0 || amount > 1000000) return res.status(400).json({ error: 'Nom et montant sont requis' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Adresse email invalide' });
  db.prepare('INSERT INTO donations (campaign_id, donor_name, donor_email, amount, message) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId || null, name, email || '', Number(amount), message || '');
  let campaignTitle = '';
  if (campaignId) {
    db.prepare('UPDATE campaigns SET collected_amount = collected_amount + ? WHERE id = ?').run(Number(amount), Number(campaignId));
    campaignTitle = db.prepare('SELECT title FROM campaigns WHERE id = ?').get(campaignId)?.title || '';
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  notifyEmail(
    `Nouveau don de ${name} — ${Number(amount).toLocaleString('fr-FR')} $${campaignTitle ? ` (${campaignTitle})` : ''}`,
    `<p><strong>${esc(name)}</strong>${email ? ` &lt;${esc(email)}&gt;` : ''} a fait un don de <strong>${Number(amount).toLocaleString('fr-FR')} $</strong>
     ${campaignTitle ? `pour la collecte <strong>${esc(campaignTitle)}</strong>` : 'de soutien'}.${message ? `<br/><em>« ${esc(message)} »</em>` : ''}</p>
     <p style="color:#888;font-size:12px">Merci de l'enregistrer dans l'espace admin → Dons.</p>`
  );
  res.json({ ok: true });
});

app.get('/api/admin/dashboard', authRequired, (req, res) => {
  const q = (s) => db.prepare(s).get();
  res.json({
    articles: q('SELECT COUNT(*) n FROM articles').n,
    causes: q('SELECT COUNT(*) n FROM causes').n,
    campaigns: q('SELECT COUNT(*) n FROM campaigns').n,
    donations: q('SELECT COUNT(*) n FROM donations').n,
    donations_total: q('SELECT COALESCE(SUM(amount),0) t FROM donations').t,
    campaigns_collected: q('SELECT COALESCE(SUM(collected_amount),0) t FROM campaigns').t,
    messages: q('SELECT COUNT(*) n FROM messages').n,
    unread_messages: q('SELECT COUNT(*) n FROM messages WHERE read = 0').n,
    latest_messages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5').all(),
    latest_donations: db.prepare('SELECT d.*, c.title AS campaign_title FROM donations d LEFT JOIN campaigns c ON c.id = d.campaign_id ORDER BY d.created_at DESC LIMIT 5').all()
  });
});

app.get('/api/admin/articles', authRequired, requireRole('any'), (req, res) => res.json(db.prepare('SELECT * FROM articles ORDER BY date DESC').all()));
app.post('/api/admin/articles', authRequired, requireRole('content'), (req, res) => {
  const { title, slug, excerpt, content, category, image, author, date, published,
    seo_title, seo_description, seo_image, seo_noindex } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const s = uniqueSlug('articles', slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  const info = db.prepare(`INSERT INTO articles (slug, title, excerpt, content, category, image, author, date, published, seo_title, seo_description, seo_image, seo_noindex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(s, title, excerpt || '', content || '', category || 'actualites', image || '', author || 'ADI ONG',
      date || new Date().toISOString().slice(0, 10), published ? 1 : 0,
      seo_title || '', seo_description || '', seo_image || '', seo_noindex ? 1 : 0);
  res.json(db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/admin/articles/:id', authRequired, requireRole('content'), (req, res) => {
  const { title, slug, excerpt, content, category, image, author, date, published,
    seo_title, seo_description, seo_image, seo_noindex } = req.body || {};
  db.prepare(`UPDATE articles SET title=?, slug=?, excerpt=?, content=?, category=?, image=?, author=?, date=?, published=?, seo_title=?, seo_description=?, seo_image=?, seo_noindex=? WHERE id=?`)
    .run(title, uniqueSlug('articles', slug || 'article', Number(req.params.id)), excerpt || '', content || '', category || 'actualites', image || '', author || 'ADI ONG',
      date || new Date().toISOString().slice(0, 10), published ? 1 : 0,
      seo_title || '', seo_description || '', seo_image || '', seo_noindex ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id));
});
app.delete('/api/admin/articles/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/causes', authRequired, requireRole('any'), (req, res) => res.json(db.prepare('SELECT * FROM causes ORDER BY sort_order').all()));
app.post('/api/admin/causes', authRequired, requireRole('content'), (req, res) => {
  const { title, slug, tagline, description, long_content, icon, image, link, sort_order } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const s = uniqueSlug('causes', slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  const info = db.prepare(`INSERT INTO causes (slug, title, tagline, description, long_content, icon, image, link, sort_order, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(s, title, tagline || '', description || '', long_content || '', icon || 'megaphone', image || '', link || '', sort_order || 99);
  res.json(db.prepare('SELECT * FROM causes WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/admin/causes/:id', authRequired, requireRole('content'), (req, res) => {
  const { title, slug, tagline, description, long_content, icon, image, link, sort_order, published } = req.body || {};
  db.prepare(`UPDATE causes SET title=?, slug=?, tagline=?, description=?, long_content=?, icon=?, image=?, link=?, sort_order=?, published=? WHERE id=?`)
    .run(title, uniqueSlug('causes', slug || 'cause', Number(req.params.id)), tagline || '', description || '', long_content || '', icon || 'megaphone', image || '', link || '', Number(sort_order || 99), published ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM causes WHERE id = ?').get(req.params.id));
});
app.delete('/api/admin/causes/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('DELETE FROM causes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/campaigns', authRequired, requireRole('any'), (req, res) => res.json(db.prepare('SELECT * FROM campaigns ORDER BY deadline').all()));
app.post('/api/admin/campaigns', authRequired, requireRole('content'), (req, res) => {
  const { title, slug, description, image, goal_amount, collected_amount, deadline, cause_slug } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Titre requis' });
  const s = uniqueSlug('campaigns', slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  const info = db.prepare(`INSERT INTO campaigns (slug, title, description, image, goal_amount, collected_amount, deadline, cause_slug, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(s, title, description || '', image || '', Number(goal_amount) || 0, Number(collected_amount) || 0, deadline || '', cause_slug || '');
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/admin/campaigns/:id', authRequired, requireRole('content'), (req, res) => {
  const { title, slug, description, image, goal_amount, collected_amount, deadline, cause_slug, published } = req.body || {};
  db.prepare(`UPDATE campaigns SET title=?, slug=?, description=?, image=?, goal_amount=?, collected_amount=?, deadline=?, cause_slug=?, published=? WHERE id=?`)
    .run(title, uniqueSlug('campaigns', slug || 'collecte', Number(req.params.id)), description || '', image || '', Number(goal_amount) || 0, Number(collected_amount) || 0, deadline || '', cause_slug || '', published ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id));
});
app.delete('/api/admin/campaigns/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Partenaires (bandeau de logos au-dessus du footer)
app.get('/api/admin/partners', authRequired, requireRole('any'), (req, res) =>
  res.json(db.prepare('SELECT * FROM partners ORDER BY sort_order, id').all()));

app.post('/api/admin/partners', authRequired, requireRole('content'), (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim() || !String(b.logo || '').trim())
    return res.status(400).json({ error: 'Nom et logo du partenaire sont requis' });
  const info = db.prepare('INSERT INTO partners (name, logo, link, sort_order, published) VALUES (?, ?, ?, ?, ?)')
    .run(String(b.name).trim(), b.logo, b.link || '', Number(b.sort_order) || 0, b.published === false ? 0 : 1);
  res.json(db.prepare('SELECT * FROM partners WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/admin/partners/:id', authRequired, requireRole('content'), (req, res) => {
  const ex = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Partenaire introuvable' });
  const b = { ...ex, ...req.body };
  db.prepare('UPDATE partners SET name = ?, logo = ?, link = ?, sort_order = ?, published = ? WHERE id = ?')
    .run(String(b.name).trim(), b.logo, b.link || '', Number(b.sort_order) || 0, b.published ? 1 : 0, ex.id);
  res.json(db.prepare('SELECT * FROM partners WHERE id = ?').get(ex.id));
});

app.delete('/api/admin/partners/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('DELETE FROM partners WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/donations', authRequired, requireRole('any'), (req, res) =>
  res.json(db.prepare('SELECT d.*, c.title AS campaign_title FROM donations d LEFT JOIN campaigns c ON c.id = d.campaign_id ORDER BY d.created_at DESC').all()));
app.put('/api/admin/donations/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('UPDATE donations SET status = ? WHERE id = ?').run(req.body?.status || 'nouvelle', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/donations/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('DELETE FROM donations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/messages', authRequired, requireRole('any'), (req, res) => res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()));
app.put('/api/admin/messages/:id', authRequired, requireRole('any'), (req, res) => {
  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/messages/:id', authRequired, requireRole('content'), (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/settings', authRequired, requireRole('admin'), (req, res) => {
  const s = publicSite();
  s.stats = JSON.parse(JSON.stringify(s.stats));
  s.values = JSON.parse(JSON.stringify(s.values));
  s.method = JSON.parse(JSON.stringify(s.method));
  res.json(s);
});
const SETTING_KEYS = new Set([...STRING_SETTINGS, ...Object.keys(JSON_SETTINGS)]);
app.put('/api/admin/settings', authRequired, requireRole('admin'), (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!SETTING_KEYS.has(k)) continue;
    const value = typeof v === 'string' ? v : JSON.stringify(v);
    setSetting(k, value);
  }
  res.json(publicSite());
});

app.post('/api/admin/upload', authRequired, requireRole('content'), (req, res) => {
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
  const base = original || 'image';
  if (!db.prepare('SELECT 1 FROM media WHERE filename = ?').get(base)) return base;
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  return `${stem}-${Date.now()}${ext || '.jpg'}`;
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

async function optimizeBuffer(buffer, originalName = 'image.jpg') {
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const origExt = path.extname(originalName).toLowerCase() || '.jpg';
  const looksPdf = origExt === '.pdf' || buffer.slice(0, 5).toString() === '%PDF-';
  if (looksPdf) {
    const mainName = `${stamp}.pdf`;
    fs.writeFileSync(path.join(docsDir, mainName), buffer);
    return { folder: 'docs', mainName, thumbName: mainName, width: 0, height: 0, size: buffer.length };
  }
  if (origExt === '.svg') {
    const mainName = `${stamp}.svg`;
    fs.writeFileSync(path.join(mediaDir, mainName), buffer);
    return { folder: 'media', mainName, thumbName: mainName, width: 0, height: 0, size: buffer.length };
  }
  try {
    const image = await Jimp.read(buffer);
    const keepPng = origExt === '.png';
    const mainExt = keepPng ? 'png' : 'jpg';

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
    const mainName = `${stamp}${origExt}`;
    fs.writeFileSync(path.join(mediaDir, mainName), buffer);
    return { folder: 'media', mainName, thumbName: mainName, width: 0, height: 0, size: buffer.length };
  }
}

app.post('/api/admin/media', authRequired, requireRole('content'), (req, res) => {
  memoryUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
      const opt = await optimizeBuffer(req.file.buffer, req.file.originalname);
      const folder = opt.folder || 'media';
      const url = `/uploads/${folder}/${opt.mainName}`;
      const thumb = `/uploads/${folder}/${opt.thumbName}`;
      const alt = String(req.body?.alt || '').slice(0, 300);
      const filename = uniqueMediaFilename(req.file.originalname);
      const info = db.prepare(`INSERT INTO media (filename, url, thumb, size, width, height, mime, alt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(filename, url, thumb, opt.size, opt.width, opt.height, req.file.mimetype, alt);
      res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid));
    } catch (e) {
      res.status(400).json({ error: `Échec de l'optimisation : ${e.message}` });
    }
  });
});

app.get('/api/admin/media', authRequired, requireRole('content'), (req, res) => {
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

app.patch('/api/admin/media/:id', authRequired, requireRole('content'), (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Image introuvable' });
  const alt = String(req.body?.alt ?? (m.alt || '')).slice(0, 300);
  db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(alt, m.id);
  res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(m.id));
});

app.delete('/api/admin/media/:id', authRequired, requireRole('content'), (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Fichier introuvable' });
  const used =
    db.prepare('SELECT COUNT(*) n FROM articles WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM causes WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM campaigns WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM users WHERE photo = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM partners WHERE logo = ?').get(m.url).n +
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
    if (!['super_admin', 'admin', 'editor', 'viewer'].includes(role)) throw Object.assign(new Error('Rôle invalide'), { status: 400 });
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

app.get('/api/admin/security', authRequired, requireRole('admin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM security_events ORDER BY id DESC LIMIT 100').all());
});

app.get('/api/admin/users', authRequired, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all();
  res.json(users.map(publicUser));
});

app.post('/api/admin/users', authRequired, requireRole('admin'), (req, res) => {
  const { email, password, full_name, role, photo, phone, job_title, bio } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  if (!['super_admin', 'admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
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

app.put('/api/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  try {
    applyUserFields(user, req.body, { allowRole: true, actorRole: req.user.role });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)));
});

app.post('/api/admin/users/:id/code', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  db.prepare('UPDATE users SET unique_code = ? WHERE id = ?').run(newUniqueCode(), user.id);
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)));
});

app.delete('/api/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
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
    is_super: req.user.role === 'super_admin'
  });
});

app.put('/api/admin/modules', authRequired, requireRole('super'), (req, res) => {
  const { grh_enabled, pos_enabled } = req.body || {};
  if (typeof grh_enabled === 'boolean') setSetting('grh_enabled', grh_enabled ? '1' : '0');
  if (typeof pos_enabled === 'boolean') setSetting('pos_enabled', pos_enabled ? '1' : '0');
  res.json({
    grh_enabled: getSetting('grh_enabled') === '1',
    pos_enabled: getSetting('pos_enabled') === '1',
    is_super: true
  });
});

// ---------- GRH (rôles admin+super, module activable) ----------
const GRH = [authRequired, requireRole('hr'), requireModule('grh_enabled', 'GRH')];

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
  const active = db.prepare("SELECT COUNT(*) n FROM grh_employees WHERE status = 'actif'").get().n;
  const total = db.prepare('SELECT COUNT(*) n FROM grh_employees').get().n;
  const leavesPending = db.prepare("SELECT COUNT(*) n FROM grh_leaves WHERE status = 'en_attente'").get().n;
  const today = new Date().toISOString().slice(0, 10);
  const leavesOngoing = db.prepare(
    "SELECT COUNT(*) n FROM grh_leaves WHERE status = 'approuve' AND start_date <= ? AND (end_date = '' OR end_date >= ?)"
  ).get(today, today).n;
  const byDept = db.prepare(`
    SELECT COALESCE(d.name, 'Non affecté') AS name, COUNT(e.id) AS n
    FROM grh_employees e LEFT JOIN grh_departments d ON d.id = e.department_id
    WHERE e.status = 'actif' GROUP BY d.name ORDER BY n DESC
  `).all();
  const recentHires = db.prepare(
    "SELECT full_name, position, hire_date FROM grh_employees WHERE status = 'actif' AND hire_date != '' ORDER BY hire_date DESC LIMIT 5"
  ).all();
  const upcomingLeaves = db.prepare(`
    SELECT l.type, l.start_date, l.end_date, e.full_name
    FROM grh_leaves l JOIN grh_employees e ON e.id = l.employee_id
    WHERE l.status = 'approuve' AND l.start_date >= ? ORDER BY l.start_date LIMIT 5
  `).all(today);
  res.json({ active, total, leavesPending, leavesOngoing, byDept, recentHires, upcomingLeaves });
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
  } catch {
    res.status(409).json({ error: 'Cet email est déjà utilisé par un autre employé' });
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
  } catch {
    res.status(409).json({ error: 'Cet email est déjà utilisé par un autre employé' });
  }
});

app.delete('/api/admin/grh/employees/:id', ...GRH, (req, res) => {
  db.prepare('DELETE FROM grh_leaves WHERE employee_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_evaluations WHERE employee_id = ?').run(req.params.id);
  db.prepare('DELETE FROM grh_training_attendees WHERE employee_id = ?').run(req.params.id);
  const docs = db.prepare('SELECT * FROM grh_documents WHERE employee_id = ?').all(req.params.id);
  docs.forEach((d) => {
    const full = path.join(empDocsDir, d.file);
    if (fs.existsSync(full)) fs.unlink(full, () => {});
  });
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
  const full = path.join(empDocsDir, doc.file);
  if (fs.existsSync(full)) fs.unlink(full, () => {});
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

// ---------- Paie (super admin uniquement : les salaires sont confidentiels) ----------
const PAY = [authRequired, requireRole('super'), requireModule('grh_enabled', 'GRH')];
const validMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
const monthLabelFr = (m) => {
  const [y, mo] = String(m).split('-');
  return new Date(Date.UTC(Number(y), Number(mo) - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fmtMoney = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

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
      ['Total', fmtMoney(p.base_salary + p.bonus)]
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
  if (ex.cv_file) {
    const full = path.join(cvDir, ex.cv_file);
    if (fs.existsSync(full)) fs.unlink(full, () => {});
  }
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
  next();
};
app.get('/api/me/employee', authRequired, requireModule('grh_enabled', 'GRH'), selfEmployeeGuard, (req, res) => {
  const emp = req.employee;
  const dept = emp.department_id ? db.prepare('SELECT name FROM grh_departments WHERE id = ?').get(emp.department_id)?.name : '';
  res.json({ ...emp, salary: null, salary_currency: null, department: dept, balance: leaveBalance(emp.id) });
});
app.get('/api/me/employee/leaves', authRequired, requireModule('grh_enabled', 'GRH'), selfEmployeeGuard, (req, res) => {
  res.json(db.prepare('SELECT * FROM grh_leaves WHERE employee_id = ? ORDER BY start_date DESC').all(req.employee.id));
});
app.get('/api/me/employee/announcements', authRequired, requireModule('grh_enabled', 'GRH'), selfEmployeeGuard, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(db.prepare(`
    SELECT id, title, content, pinned, expires_at, created_at
    FROM grh_announcements
    WHERE expires_at = '' OR expires_at >= ?
    ORDER BY pinned DESC, created_at DESC, id DESC
  `).all(today));
});
const myLeaveLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `myleave:${req.user?.id || req.ip}`, message: 'Trop de demandes de congé. Réessayez plus tard.' });
app.post('/api/me/employee/leaves', authRequired, requireModule('grh_enabled', 'GRH'), selfEmployeeGuard, myLeaveLimiter, (req, res) => {
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
app.delete('/api/me/employee/leaves/:id', authRequired, requireModule('grh_enabled', 'GRH'), selfEmployeeGuard, (req, res) => {
  const leave = db.prepare('SELECT * FROM grh_leaves WHERE id = ? AND employee_id = ?').get(req.params.id, req.employee.id);
  if (!leave) return res.status(404).json({ error: 'Demande introuvable' });
  if (leave.status !== 'en_attente') return res.status(409).json({ error: 'Seule une demande en attente peut être retirée.' });
  db.prepare('DELETE FROM grh_leaves WHERE id = ?').run(leave.id);
  res.json({ ok: true });
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
app.get('/api/admin/invites', authRequired, requireRole('admin'), (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, u.full_name AS created_by_name
    FROM invites i LEFT JOIN users u ON u.id = i.created_by
    ORDER BY i.created_at DESC
  `).all();
  res.json(rows.map((r) => ({ ...r, state: inviteState(r) })));
});

app.post('/api/admin/invites', authRequired, requireRole('admin'), (req, res) => {
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

app.delete('/api/admin/invites/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM invites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Point de vente + stock (rôles admin+super, module activable) ----------
const POS = [authRequired, requireRole('admin'), requireModule('pos_enabled', 'Point de vente')];
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

app.post('/api/admin/pos/categories', ...POS, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom de la catégorie requis' });
  try {
    const info = db.prepare('INSERT INTO stock_categories (name) VALUES (?)').run(name);
    res.json(db.prepare('SELECT * FROM stock_categories WHERE id = ?').get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Cette catégorie existe déjà' });
  }
});

app.put('/api/admin/pos/categories/:id', ...POS, (req, res) => {
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

app.delete('/api/admin/pos/categories/:id', ...POS, (req, res) => {
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
  if (search) { where.push('(p.name LIKE ? OR p.reference LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category_id) { where.push('p.category_id = ?'); params.push(category_id); }
  if (active === '1') where.push('p.active = 1');
  if (active === '0') where.push('p.active = 0');
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY p.name';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/admin/pos/products', ...POS, (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nom du produit requis' });
  const price = Math.max(0, Number(b.price) || 0);
  const stock = Math.max(0, Math.trunc(Number(b.stock) || 0));
  const cost = b.cost === '' || b.cost == null ? null : Math.max(0, Number(b.cost) || null);
  const info = runTx(() => {
    const r = db.prepare(`INSERT INTO stock_products
      (name, reference, description, category_id, price, cost, stock, min_stock, image, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      String(b.name).trim().slice(0, 200),
      String(b.reference || '').trim().slice(0, 40),
      String(b.description || '').slice(0, 2000),
      b.category_id || null,
      price,
      cost,
      stock,
      Math.max(0, Math.trunc(Number(b.min_stock) || 0)),
      b.image || '',
      b.active === false || b.active === 0 || b.active === '0' ? 0 : 1
    );
    if (stock > 0) {
      db.prepare('INSERT INTO stock_movements (product_id, type, qty, reason, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(r.lastInsertRowid, 'entree', stock, 'Stock initial', req.user.id);
    }
    return r.lastInsertRowid;
  });
  res.json(db.prepare('SELECT * FROM stock_products WHERE id = ?').get(info));
});

app.put('/api/admin/pos/products/:id', ...POS, (req, res) => {
  const ex = db.prepare('SELECT * FROM stock_products WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Produit introuvable' });
  const b = { ...ex, ...req.body };
  const nextStock = Math.max(0, Math.trunc(Number(b.stock) || 0));
  const cost = b.cost === '' || b.cost == null ? null : Math.max(0, Number(b.cost) || null);
  runTx(() => {
    db.prepare(`UPDATE stock_products SET
      name = ?, reference = ?, description = ?, category_id = ?, price = ?, cost = ?, stock = ?, min_stock = ?, image = ?, active = ?
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
      ex.id
    );
    if (nextStock !== ex.stock) {
      db.prepare('INSERT INTO stock_movements (product_id, type, qty, new_stock, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ex.id, 'ajustement', Math.abs(nextStock - ex.stock), nextStock, 'Mise à jour du stock depuis la fiche produit', req.user.id);
    }
  });
  res.json(db.prepare('SELECT * FROM stock_products WHERE id = ?').get(ex.id));
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

app.delete('/api/admin/pos/products/:id', ...POS, (req, res) => {
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
app.post('/api/admin/pos/sales', ...POS, (req, res) => {
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
app.post('/api/admin/pos/sales/:id/return', ...POS, (req, res) => {
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
app.delete('/api/admin/pos/sales/:id', ...POS, (req, res) => {
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
    const fmtM = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

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
    for (const it of s.items) {
      page.drawText(`${it.qty} × ${it.product_name}`.slice(0, 48), { x: 30, y, size: 9, font, color: ink });
      const val = fmtM(it.total);
      page.drawText(val, { x: W - 30 - font.widthOfTextAtSize(val, 9), y, size: 9, font, color: ink });
      y -= 13;
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
app.get('/api/admin/pos/stats', ...POS, (req, res) => {
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

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API ADI ONG sur http://0.0.0.0:${PORT}`));
