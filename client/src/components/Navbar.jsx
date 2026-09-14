import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconClose, IconHeart, IconMenu } from './Icons.jsx';
import { useSite } from '../hooks/useSite.jsx';

const links = [
  { to: '/', label: 'Accueil' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/notre-travail', label: 'Notre travail' },
  { to: '/actualites', label: 'Actualités' },
  { to: '/collectes', label: 'Collectes' },
  { to: '/contact', label: 'Contact' }
];

export default function Navbar() {
  const { site } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [loc.pathname]);

  const solid = scrolled || open || loc.pathname.startsWith('/admin');

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid ? 'bg-white/90 shadow-soft backdrop-blur-lg' : 'bg-transparent'
      }`}
    >
      <nav className="container-x flex h-[76px] items-center justify-between gap-4">
        <Link to="/" className="group flex items-center gap-3" aria-label="Accueil ADI ONG">
          {site.logo ? (
            <img
              src={site.logo}
              alt={site.site_name || 'ADI ONG'}
              className="h-12 max-w-[180px] rounded-xl object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft transition-transform duration-300 group-hover:rotate-6">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3" fill="#f5a524" stroke="none" />
                <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <span className="leading-tight">
            <span className={`block font-display text-lg font-bold ${solid ? 'text-ink-900' : 'text-white'}`}>
              {site.site_name || 'ADI ONG'}
            </span>
            {!site.logo && (
              <span className={`hidden text-[11px] font-medium tracking-wide sm:block ${solid ? 'text-ink-400' : 'text-white/70'}`}>
                Inclusion &amp; Accessibilité
              </span>
            )}
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${
                    isActive
                      ? solid
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-white/15 text-white'
                      : solid
                        ? 'text-ink-600 hover:text-brand-700'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
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
