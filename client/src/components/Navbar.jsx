import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconArrow, IconClose, IconHeart, IconMenu } from './Icons.jsx';
import { useSite } from '../hooks/useSite.jsx';
import { categoryLabel } from './Cards.jsx';
import { fmtDate } from '../api.js';

const links = [
  { to: '/', label: 'Accueil' },
  { to: '/a-propos', label: 'À propos', mega: 'about' },
  { to: '/notre-travail', label: 'Notre travail', mega: 'work' },
  { to: '/actualites', label: 'Actualités', mega: 'news' },
  { to: '/collectes', label: 'Collectes', mega: 'campaigns' },
  { to: '/contact', label: 'Contact' }
];

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
  const [mobileAcc, setMobileAcc] = useState(null);
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
    setMobileAcc(null);
  }, [loc.pathname]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openMega = (id) => {
    clearTimeout(closeTimer.current);
    setMega(id);
  };
  const scheduleCloseMega = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(null), 280);
  };

  const solid = scrolled || open || mega || loc.pathname.startsWith('/admin');

  const itemClass = (isActive, hasMega, isMegaOpen) => {
    if (isMegaOpen) return 'bg-accent-400 text-ink-950';
    if (isActive) return solid ? 'bg-brand-50 text-brand-700' : 'bg-white/15 text-white';
    return solid
      ? 'text-ink-600 hover:bg-accent-400 hover:text-ink-950'
      : 'text-white/85 hover:bg-accent-400 hover:text-ink-950';
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid ? 'bg-white/95 shadow-soft backdrop-blur-lg' : 'bg-transparent'
      }`}
    >
      <div onMouseEnter={() => clearTimeout(closeTimer.current)} onMouseLeave={scheduleCloseMega}>
        <nav className="container-x flex h-[76px] items-center justify-between gap-4">
          <Link to="/" className="group flex items-center gap-3" aria-label="Accueil ADI ONG" onMouseEnter={() => openMega(null)}>
            {site.logo ? (
              <span className="rounded-xl bg-white px-2.5 py-1.5 shadow-soft ring-1 ring-ink-950/5">
                <img
                  src={site.logo}
                  alt={site.site_name || 'ADI ONG'}
                  className="h-9 max-w-[160px] object-contain sm:h-10 sm:max-w-[200px] lg:max-w-[220px] transition-transform duration-300 group-hover:scale-105"
                />
              </span>
            ) : (
              <>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft transition-transform duration-300 group-hover:rotate-6">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="3" fill="#fc7a03" stroke="none" />
                    <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="leading-tight">
                  <span className={`block font-display text-lg font-bold ${solid ? 'text-ink-900' : 'text-white'}`}>
                    {site.site_name || 'ADI ONG'}
                  </span>
                </span>
              </>
            )}
          </Link>

          <ul className="hidden items-center gap-0.5 lg:flex">
            {links.map((l) => (
              <li
                key={l.to}
                className="static"
                onMouseEnter={() => openMega(l.mega || null)}
              >
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
                {l.mega && (
                  <div
                    className={`absolute inset-x-0 top-[calc(100%-10px)] z-50 pt-2.5 transition-opacity duration-150 ${
                      mega === l.mega ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
                    }`}
                    onMouseEnter={() => openMega(l.mega)}
                  >
                    <div className="border-t-4 border-accent-400 bg-white shadow-lift">
                      <div className="container-x py-6">
                        {l.mega === 'news' && <NewsMega featured={featured} more={moreNews} />}
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

          <div className="flex items-center gap-3" onMouseEnter={() => openMega(null)}>
            <Link to="/faire-un-don" className="btn-accent hidden !px-5 !py-2.5 text-sm sm:inline-flex">
              <IconHeart className="h-4 w-4" />
              Faire un don
            </Link>
            <button
              className={`grid h-11 w-11 place-items-center rounded-xl lg:hidden ${
                solid ? 'bg-ink-50 text-ink-800' : 'bg-white/15 text-white backdrop-blur'
              }`}
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="overflow-hidden border-t border-ink-100 bg-white shadow-lift lg:hidden"
          >
            <ul className="container-x flex flex-col gap-1 py-4">
              {links.map((l, i) => (
                <motion.li
                  key={l.to}
                  initial={reduce ? false : { opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  {l.mega ? (
                    <div>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-4 py-3 font-semibold text-ink-700 hover:bg-cream"
                        onClick={() => setMobileAcc(mobileAcc === l.mega ? null : l.mega)}
                      >
                        {l.label}
                        <Chevron className={`h-4 w-4 transition-transform ${mobileAcc === l.mega ? 'rotate-180' : ''}`} />
                      </button>
                      {mobileAcc === l.mega && (
                        <div className="mb-2 ml-3 space-y-1 border-l-2 border-brand-100 pl-3">
                          {l.mega === 'news' &&
                            latest.map((a) => (
                              <Link
                                key={a.id}
                                to={`/actualites/${a.slug}`}
                                className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                              >
                                {a.title}
                              </Link>
                            ))}
                          {l.mega === 'work' &&
                            causes.map((c) => (
                              <Link
                                key={c.id}
                                to={`/notre-travail/${c.slug}`}
                                className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                              >
                                {c.title}
                              </Link>
                            ))}
                          {l.mega === 'campaigns' &&
                            campaigns.map((c) => (
                              <Link
                                key={c.id}
                                to={`/collectes/${c.slug}`}
                                className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                              >
                                {c.title}
                              </Link>
                            ))}
                          {l.mega === 'about' &&
                            aboutLinks.map((s) => (
                              <Link
                                key={s.to}
                                to={s.to}
                                className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                              >
                                {s.label}
                              </Link>
                            ))}
                          <Link
                            to={l.to}
                            className="block px-3 py-2 text-xs font-bold tracking-wide text-brand-600 uppercase"
                          >
                            Tout voir
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <NavLink
                      to={l.to}
                      end={l.to === '/'}
                      className={({ isActive }) =>
                        `block rounded-xl px-4 py-3 font-semibold ${
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-cream'
                        }`
                      }
                    >
                      {l.label}
                    </NavLink>
                  )}
                </motion.li>
              ))}
              <li className="pt-2">
                <Link to="/faire-un-don" className="btn-accent w-full">
                  <IconHeart className="h-4 w-4" /> Faire un don
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function NewsMega({ featured, more }) {
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
            {featured.category ? ` — ${categoryLabel(featured.category)}` : ''}
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
              {a.category ? ` — ${categoryLabel(a.category)}` : ''}
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
