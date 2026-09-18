import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconArrow, IconClose, IconHeart, IconMail, IconMenu, IconPhone } from './Icons.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { categoryLabel } from './Cards.jsx';
import { api, fmtDate } from '../api.js';
import { isExternalHref, resolveDonateCta, resolveHeaderMenu } from '../lib/menus.js';

const aboutLinks = [
  { to: '/a-propos', label: 'Qui sommes-nous ?' },
  { to: '/notre-travail', label: 'Notre travail' },
  { to: '/contact', label: 'Nous contacter' }
];

const Chevron = (p) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={p.className || 'h-3.5 w-3.5'} aria-hidden>
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
  </svg>
);

function megaDate(d) {
  return d
    ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
    : '';
}

export default function Navbar() {
  const { site, articles = [], causes = [], campaigns = [] } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(null);
  const [shopEnabled, setShopEnabled] = useState(false);

  useEffect(() => {
    api.modules.public().then((m) => setShopEnabled(!!m.pos_enabled)).catch(() => setShopEnabled(false));
  }, []);

  const navLinks = resolveHeaderMenu(site, { shopEnabled });
  const donate = resolveDonateCta(site);
  const loc = useLocation();
  const reduce = useReducedMotion();
  const closeTimer = useRef(null);

  const latest = articles.slice(0, 5);
  const featured = latest[0];
  const moreNews = latest.slice(1, 5);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMega(null);
  }, [loc.pathname]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const y = window.scrollY;
    const html = document.documentElement;
    html.classList.add('nav-drawer-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    return () => {
      html.classList.remove('nav-drawer-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    };
  }, [open]);

  const openMega = (id) => {
    clearTimeout(closeTimer.current);
    setMega(id);
  };
  const scheduleCloseMega = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(null), 280);
  };

  const solid = scrolled || open || mega || loc.pathname.startsWith('/admin');
  const phone = site.phone1 || site.phone2 || '';
  const email = site.email || '';
  const tagline = site.site_tagline || '';

  const itemClass = (isActive, hasMega, isMegaOpen) => {
    if (isMegaOpen) return 'bg-accent-400 text-ink-950';
    if (isActive) return solid ? 'bg-brand-50 text-brand-700' : 'bg-white/15 text-white';
    return solid
      ? 'text-ink-600 hover:bg-accent-400 hover:text-ink-950'
      : 'text-white/85 hover:bg-accent-400 hover:text-ink-950';
  };

  return (
    <header
      className={`site-chrome-top fixed inset-x-0 top-0 z-50 bg-white shadow-soft transition-[background-color,box-shadow] duration-300 ${
        solid ? 'lg:bg-white lg:shadow-soft' : 'lg:bg-transparent lg:shadow-none'
      }`}
    >
      <div onMouseEnter={() => clearTimeout(closeTimer.current)} onMouseLeave={scheduleCloseMega}>
        <nav className="container-x flex h-16 items-center justify-between gap-3 sm:h-[76px] sm:gap-4">
          <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="Accueil ADI ONG" onMouseEnter={() => openMega(null)}>
            {site.logo ? (
              <span className="rounded-xl bg-white px-2 py-1 shadow-soft ring-1 ring-ink-950/5 sm:px-2.5 sm:py-1.5">
                <img
                  src={site.logo}
                  alt={site.site_name || 'ADI ONG'}
                  className="h-8 max-w-[132px] object-contain sm:h-10 sm:max-w-[200px] lg:max-w-[220px] transition-transform duration-300 group-hover:scale-105"
                />
              </span>
            ) : (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft transition-transform duration-300 group-hover:rotate-6 sm:h-11 sm:w-11">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="3" fill="#fc7a03" stroke="none" />
                    <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="leading-tight">
                  <span className={`block font-display text-base font-bold text-ink-900 sm:text-lg ${solid ? '' : 'lg:text-white'}`}>
                    {site.site_name || 'ADI ONG'}
                  </span>
                </span>
              </>
            )}
          </Link>

          <ul className="hidden items-center gap-0.5 lg:flex">
            {navLinks.map((l) => (
              <li
                key={`${l.to}-${l.label}`}
                className="static"
                onMouseEnter={() => openMega(l.mega || null)}
              >
                {isExternalHref(l.to) ? (
                  <a
                    href={l.to}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-[15px] font-semibold transition-colors ${itemClass(false, !!l.mega, mega === l.mega)}`}
                  >
                    {l.label}
                  </a>
                ) : (
                  <NavLink
                    to={l.to}
                    end={l.to === '/'}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-[15px] font-semibold transition-colors ${itemClass(
                        isActive,
                        !!l.mega,
                        mega === l.mega
                      )}`
                    }
                    aria-expanded={l.mega ? mega === l.mega : undefined}
                    aria-haspopup={l.mega ? 'true' : undefined}
                  >
                    {l.label}
                    {l.mega && <Chevron className="h-3.5 w-3.5 opacity-70" />}
                  </NavLink>
                )}
                {l.mega && !isExternalHref(l.to) && (
                  <div
                    className={`absolute inset-x-0 top-[calc(100%-10px)] z-50 pt-2.5 transition-opacity duration-150 ${
                      mega === l.mega ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
                    }`}
                    onMouseEnter={() => openMega(l.mega)}
                  >
                    <div className="border-t-4 border-accent-400 bg-white shadow-lift">
                      <div className="container-x py-6">
                        {l.mega === 'news' && (
                          <NewsMega featured={featured} more={moreNews} categories={site.article_categories} />
                        )}
                        {l.mega === 'work' && <WorkMega causes={causes} />}
                        {l.mega === 'campaigns' && <CampaignsMega campaigns={campaigns} />}
                        {l.mega === 'about' && <AboutMega />}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 sm:gap-3" onMouseEnter={() => openMega(null)}>
            {isExternalHref(donate.to) ? (
              <a href={donate.to} target="_blank" rel="noreferrer" className="btn-accent hidden !px-5 !py-2.5 text-sm sm:inline-flex">
                <IconHeart className="h-4 w-4" />
                {donate.label}
              </a>
            ) : (
              <Link to={donate.to} className="btn-accent hidden !px-5 !py-2.5 text-sm sm:inline-flex">
                <IconHeart className="h-4 w-4" />
                {donate.label}
              </Link>
            )}
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-xl bg-ink-50 text-ink-800 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={open}
            >
              {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="mobile-nav"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[100] lg:hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-ink-950/55"
                  aria-label="Fermer le menu"
                  onClick={() => setOpen(false)}
                />
                <motion.aside
                  initial={reduce ? false : { x: '100%' }}
                  animate={{ x: 0 }}
                  exit={reduce ? undefined : { x: '100%' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  className="absolute inset-y-0 right-0 flex w-[min(100vw,22rem)] flex-col bg-cream shadow-lift"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  <div className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-4">
                    {site.logo ? (
                      <img src={site.logo} alt="" className="h-9 max-w-[7.5rem] object-contain" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="8" r="3" fill="#fc7a03" stroke="none" />
                          <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold text-ink-900">{site.site_name || 'ADI ONG'}</p>
                      {tagline && <p className="truncate text-xs text-ink-400">{tagline}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-700"
                      aria-label="Fermer"
                    >
                      <IconClose className="h-5 w-5" />
                    </button>
                  </div>

                  <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                    <p className="mb-2 px-2 text-[11px] font-bold tracking-wide text-ink-400 uppercase">Navigation</p>
                    <ul className="flex flex-col gap-1">
                      {navLinks.map((l) => (
                        <li key={`${l.to}-${l.label}`}>
                          {isExternalHref(l.to) ? (
                            <a
                              href={l.to}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-[15px] font-semibold text-ink-800 shadow-soft ring-1 ring-ink-950/5"
                              onClick={() => setOpen(false)}
                            >
                              <span>{l.label}</span>
                              <IconArrow className="h-4 w-4 shrink-0 text-ink-300" />
                            </a>
                          ) : (
                            <NavLink
                              to={l.to}
                              end={l.to === '/'}
                              onClick={() => setOpen(false)}
                              className={({ isActive }) =>
                                `flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-semibold shadow-soft ring-1 ${
                                  isActive
                                    ? 'bg-brand-600 text-white ring-brand-600'
                                    : 'bg-white text-ink-800 ring-ink-950/5'
                                }`
                              }
                            >
                              <span>{l.label}</span>
                              <IconArrow className="h-4 w-4 shrink-0 opacity-50" />
                            </NavLink>
                          )}
                        </li>
                      ))}
                    </ul>
                  </nav>

                  <div className="space-y-3 border-t border-ink-100 bg-white p-4">
                    {isExternalHref(donate.to) ? (
                      <a href={donate.to} target="_blank" rel="noreferrer" className="btn-accent w-full !py-3.5" onClick={() => setOpen(false)}>
                        <IconHeart className="h-4 w-4" /> {donate.label}
                      </a>
                    ) : (
                      <Link to={donate.to} className="btn-accent w-full !py-3.5" onClick={() => setOpen(false)}>
                        <IconHeart className="h-4 w-4" /> {donate.label}
                      </Link>
                    )}
                    {(phone || email) && (
                      <div className="space-y-1.5 pt-1">
                        {phone && (
                          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                            <IconPhone className="h-4 w-4 text-brand-600" />
                            {phone}
                          </a>
                        )}
                        {email && (
                          <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                            <IconMail className="h-4 w-4 text-brand-600" />
                            {email}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </header>
  );
}

function NewsMega({ featured, more, categories }) {
  if (!featured) {
    return (
      <p className="text-sm text-ink-500">
        Aucun article pour le moment.{' '}
        <Link to="/actualites" className="font-bold text-brand-600">Voir les actualités</Link>
      </p>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <Link to={`/actualites/${featured.slug}`} className="group grid gap-5 sm:grid-cols-2">
        {featured.image && (
          <div className="overflow-hidden rounded-xl">
            <img
              src={featured.image}
              alt={featured.title}
              className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-full"
            />
          </div>
        )}
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">
            {megaDate(featured.date)}
            {featured.category ? ` — ${categoryLabel(featured.category, categories)}` : ''}
          </p>
          <h3 className="mt-2 font-display text-lg font-bold leading-snug text-ink-900 group-hover:text-brand-700">
            {featured.title}
          </h3>
        </div>
      </Link>
      <div className="flex flex-col justify-center divide-y divide-ink-100">
        {more.map((a) => (
          <Link key={a.id} to={`/actualites/${a.slug}`} className="group py-3 first:pt-0 last:pb-0">
            <p className="text-[11px] font-bold tracking-wide text-ink-400 uppercase">
              {megaDate(a.date)}
              {a.category ? ` — ${categoryLabel(a.category, categories)}` : ''}
            </p>
            <p className="mt-0.5 font-display text-[15px] font-bold leading-snug text-ink-900 group-hover:text-brand-700">
              {a.title}
            </p>
          </Link>
        ))}
        <Link
          to="/actualites"
          className="inline-flex items-center gap-2 pt-4 text-sm font-bold text-brand-600 hover:text-brand-700"
        >
          Toutes les actualités <IconArrow className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function WorkMega({ causes }) {
  if (!causes.length) {
    return (
      <Link to="/notre-travail" className="text-sm font-bold text-brand-600">
        Voir notre travail
      </Link>
    );
  }
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {causes.slice(0, 4).map((c) => (
          <Link key={c.id} to={`/notre-travail/${c.slug}`} className="group overflow-hidden rounded-xl ring-1 ring-ink-100 hover:ring-brand-300">
            {c.image && (
              <img src={c.image} alt="" className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            )}
            <p className="px-3 py-3 font-display text-sm font-bold text-ink-900 group-hover:text-brand-700">{c.title}</p>
          </Link>
        ))}
      </div>
      <Link to="/notre-travail" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600">
        Tous les domaines <IconArrow className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CampaignsMega({ campaigns }) {
  if (!campaigns.length) {
    return (
      <Link to="/collectes" className="text-sm font-bold text-brand-600">
        Voir les collectes
      </Link>
    );
  }
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {campaigns.slice(0, 3).map((c) => (
          <Link key={c.id} to={`/collectes/${c.slug}`} className="group rounded-xl p-4 ring-1 ring-ink-100 hover:ring-brand-300">
            <p className="font-display font-bold text-ink-900 group-hover:text-brand-700">{c.title}</p>
            {c.deadline && (
              <p className="mt-1 text-xs font-semibold text-ink-400">Échéance : {fmtDate(c.deadline)}</p>
            )}
          </Link>
        ))}
      </div>
      <Link to="/collectes" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600">
        Toutes les collectes <IconArrow className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AboutMega() {
  return (
    <div className="flex flex-wrap gap-3">
      {aboutLinks.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className="rounded-xl px-5 py-3 font-display text-sm font-bold text-ink-800 ring-1 ring-ink-100 hover:bg-accent-400 hover:text-ink-950 hover:ring-accent-400"
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
