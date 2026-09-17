/** Menus CMS (header / footer) — défauts alignés sur le seed serveur. */

export const DEFAULT_MENU_HEADER = [
  { label: 'Accueil', to: '/', mega: '' },
  { label: 'À propos', to: '/a-propos', mega: 'about' },
  { label: 'Notre travail', to: '/notre-travail', mega: 'work' },
  { label: 'Actualités', to: '/actualites', mega: 'news' },
  { label: 'Collectes', to: '/collectes', mega: 'campaigns' },
  { label: 'Contact', to: '/contact', mega: '' }
];

export const DEFAULT_MENU_FOOTER = [
  { label: 'Accueil', to: '/' },
  { label: 'À propos', to: '/a-propos' },
  { label: 'Actualités', to: '/actualites' },
  { label: 'Nos collectes', to: '/collectes' },
  { label: 'Contact', to: '/contact' }
];

/** Barre bas mobile — 5 liens max, plats (stables au scroll). */
export const DEFAULT_MENU_MOBILE = [
  { label: 'Accueil', to: '/' },
  { label: 'Actus', to: '/actualites' },
  { label: 'Don', to: '/faire-un-don' },
  { label: 'Collectes', to: '/collectes' },
  { label: 'Contact', to: '/contact' }
];

const MEGA_IDS = new Set(['about', 'work', 'news', 'campaigns']);

export function isExternalHref(to = '') {
  return /^https?:\/\//i.test(String(to).trim()) || String(to).trim().startsWith('mailto:');
}

export function normalizeMenuItem(raw = {}, { withMega = false } = {}) {
  const label = String(raw.label || '').trim();
  let to = String(raw.to || '/').trim() || '/';
  if (!isExternalHref(to) && !to.startsWith('/')) to = `/${to}`;
  const item = { label: label || to, to };
  if (withMega) {
    const mega = String(raw.mega || '').trim();
    item.mega = MEGA_IDS.has(mega) ? mega : '';
  }
  return item;
}

export function resolveHeaderMenu(site = {}, { shopEnabled = false } = {}) {
  const source = Array.isArray(site.menu_header) && site.menu_header.length
    ? site.menu_header
    : DEFAULT_MENU_HEADER;
  let links = source
    .map((it) => normalizeMenuItem(it, { withMega: true }))
    .filter((it) => it.label && it.to);

  if (shopEnabled && !links.some((l) => l.to === '/boutique')) {
    const contactIdx = links.findIndex((l) => l.to === '/contact');
    const shop = { label: 'Boutique', to: '/boutique', mega: '' };
    if (contactIdx >= 0) links = [...links.slice(0, contactIdx), shop, ...links.slice(contactIdx)];
    else links = [...links, shop];
  }
  return links;
}

export function resolveFooterMenu(site = {}) {
  const source = Array.isArray(site.menu_footer) && site.menu_footer.length
    ? site.menu_footer
    : DEFAULT_MENU_FOOTER;
  return source
    .map((it) => normalizeMenuItem(it))
    .filter((it) => it.label && it.to);
}

export function resolveMobileMenu(site = {}) {
  const source = Array.isArray(site.menu_mobile) && site.menu_mobile.length
    ? site.menu_mobile
    : DEFAULT_MENU_MOBILE;
  return source
    .map((it) => normalizeMenuItem(it))
    .filter((it) => it.label && it.to)
    .slice(0, 5);
}

export function resolveDonateCta(site = {}) {
  const label = String(site.menu_donate_label || 'Faire un don').trim() || 'Faire un don';
  let to = String(site.menu_donate_to || '/faire-un-don').trim() || '/faire-un-don';
  if (!isExternalHref(to) && !to.startsWith('/')) to = `/${to}`;
  return { label, to };
}
