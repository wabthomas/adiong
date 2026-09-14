import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import Jimp from 'jimp';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { seedIfEmpty, ensureSettings } from './seed.js';

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

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);

const STRING_SETTINGS = [
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

const authRequired = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
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
  admin: ['admin'],
  content: ['admin', 'editor'],
  any: ['admin', 'editor', 'viewer']
};
const requireRole = (group) => (req, res, next) => {
  if (!ROLES[group].includes(req.user?.role))
    return res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
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
    if (/^image\/(jpe?g|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté (jpg, png, webp, gif)'));
  }
});
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Identifiants incorrects' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { email: user.email, full_name: user.full_name, role: user.role } });
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
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${base}/sitemap.xml\n`);
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

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Nom, email et message sont requis' });
  db.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)').run(name, email, subject || '', message);
  res.json({ ok: true });
});

app.post('/api/donate', (req, res) => {
  const { name, email, amount, message, campaignId } = req.body || {};
  if (!name || !amount || Number(amount) <= 0) return res.status(400).json({ error: 'Nom et montant sont requis' });
  db.prepare('INSERT INTO donations (campaign_id, donor_name, donor_email, amount, message) VALUES (?, ?, ?, ?, ?)')
    .run(campaignId || null, name, email || '', Number(amount), message || '');
  if (campaignId) {
    db.prepare('UPDATE campaigns SET collected_amount = collected_amount + ? WHERE id = ?').run(Number(amount), Number(campaignId));
  }
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
app.put('/api/admin/settings', authRequired, requireRole('admin'), (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
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

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté (jpg, png, webp, gif)'));
  }
});

function scaleTo(image, maxW, maxH) {
  const { width, height } = image.bitmap;
  const scale = Math.min(maxW / width, maxH / height, 1);
  if (scale >= 1) return { w: width, h: height };
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  image.resize(w, h, Jimp.RESIZE_BICUBIC);
  return { w, h };
}

async function optimizeBuffer(buffer) {
  const image = await Jimp.read(buffer);
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const mainExt = image.mime === Jimp.MIME_IMAGE_PNG && image.bitmap.width < 800 ? 'png' : 'jpg';

  scaleTo(image, 1600, 1600);
  image.quality(82);
  const mainPath = path.join(mediaDir, `${stamp}.${mainExt}`);
  await image.writeAsync(mainPath);

  if (buffer.length > 0 && buffer.length < fs.statSync(mainPath).size) {
    fs.writeFileSync(mainPath, buffer);
  }

  const thumb = image.clone();
  scaleTo(thumb, 480, 480);
  thumb.quality(78);
  const thumbPath = path.join(mediaDir, `${stamp}.thumb.jpg`);
  await thumb.writeAsync(thumbPath);

  const size = fs.statSync(mainPath).size;
  return {
    mainName: path.basename(mainPath),
    thumbName: path.basename(thumbPath),
    width: image.bitmap.width,
    height: image.bitmap.height,
    size
  };
}

app.post('/api/admin/media', authRequired, requireRole('content'), memoryUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune image fournie' });
    const opt = await optimizeBuffer(req.file.buffer);
    const url = `/uploads/media/${opt.mainName}`;
    const thumb = `/uploads/media/${opt.thumbName}`;
    const alt = String(req.body?.alt || '').slice(0, 300);
    const info = db.prepare(`INSERT INTO media (filename, url, thumb, size, width, height, mime, alt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.file.originalname, url, thumb, opt.size, opt.width, opt.height, req.file.mimetype, alt);
    res.json(db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: `Échec de l'optimisation : ${e.message}` });
  }
});

app.get('/api/admin/media', authRequired, requireRole('content'), (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let rows = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
  if (q) rows = rows.filter((m) => m.filename.toLowerCase().includes(q));
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
  if (!m) return res.status(404).json({ error: 'Image introuvable' });
  const used =
    db.prepare('SELECT COUNT(*) n FROM articles WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM causes WHERE image = ?').get(m.url).n +
    db.prepare('SELECT COUNT(*) n FROM campaigns WHERE image = ?').get(m.url).n;
  const settingUsed = db.prepare('SELECT COUNT(*) n FROM settings WHERE value LIKE ?').get(`%${m.url}%`).n;
  if (used + settingUsed > 0)
    return res.status(409).json({ error: 'Cette image est utilisée sur le site. Remplacez-la avant de la supprimer.' });
  for (const f of [m.url, m.thumb]) {
    if (!f) continue;
    const rel = f.replace(/^\/uploads\//, '');
    try { fs.unlinkSync(path.join(uploadDir, rel)); } catch {  }
  }
  db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  res.json({ ok: true });
});

const ROLE_LABELS = { admin: 'Administrateur', editor: 'Éditeur', viewer: 'Consultation' };

function guardLastAdmin(id, role) {
  const currentAdmins = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin'").get().n;
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (target?.role === 'admin' && role !== 'admin' && currentAdmins <= 1)
    return 'Impossible : il doit rester au moins un administrateur';
  return null;
}

app.get('/api/admin/users', authRequired, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at').all();
  res.json(users.map((u) => ({ ...u, role_label: ROLE_LABELS[u.role] || u.role })));
});

app.post('/api/admin/users', authRequired, requireRole('admin'), (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  const info = db.prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
    .run(String(email).toLowerCase().trim(), bcrypt.hashSync(password, 10), full_name || email, role);
  const user = db.prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ ...user, role_label: ROLE_LABELS[user.role] });
});

app.put('/api/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const { full_name, role, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (role && !['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  const err = guardLastAdmin(user.id, role || user.role);
  if (err) return res.status(409).json({ error: err });
  if (full_name) db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, user.id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), user.id);
  }
  const fresh = db.prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ?').get(user.id);
  res.json({ ...fresh, role_label: ROLE_LABELS[fresh.role] });
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

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1d' }));
  app.get(/^(?!\/(api|uploads)\/)(?!\/(sitemap\.xml|robots\.txt|rss\.xml)$).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API ADI ONG sur http://0.0.0.0:${PORT}`));
