import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getToken, setToken, getSavedUser } from '../../api.js';

const ALL_ROLES = ['admin', 'editor', 'viewer'];

const items = [
  { to: '/admin', label: 'Tableau de bord', roles: ALL_ROLES, icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z', end: true },
  { to: '/admin/articles', label: 'Articles', roles: ['admin', 'editor'], icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V19.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.375c0-.621.504-1.125 1.125-1.125H2.25m12-1.5h3.375c.62 0 1.125.504 1.125 1.125V4.5m-2.625 5.5h5.25m-5.625 5h5.625' },
  { to: '/admin/causes', label: 'Causes', roles: ['admin', 'editor'], icon: 'M12 3v2.25M6.375 6.375l1.59 1.59m5.46 0 1.59-1.59M3 12h2.25M18.75 12H21m-2.625 5.625-1.59-1.59m-5.46 0-1.59 1.59M12 18.75V21m0-3.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z' },
  { to: '/admin/campagnes', label: 'Campagnes', roles: ['admin', 'editor'], icon: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
  { to: '/admin/dons', label: 'Dons', roles: ALL_ROLES, icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z' },
  { to: '/admin/messages', label: 'Messages', icon: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75' },
  { to: '/admin/medias', label: 'Médiathèque', roles: ['admin', 'editor'], icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', roles: ['admin'], icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
  { to: '/admin/parametres', label: 'Paramètres', roles: ['admin'], icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z' },
];

function MiniIcon({ d, className = 'h-5 w-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ROLE_LABELS = { admin: 'Administrateur', editor: 'Éditeur', viewer: 'Consultation' };

export default function AdminLayout() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(!!getToken());
  const savedUser = getSavedUser();
  const role = savedUser?.role || 'admin';
  const visibleItems = items.filter((it) => (it.roles || ALL_ROLES).includes(role));

  useEffect(() => {
    if (!getToken()) nav('/admin/login', { replace: true });
  }, [nav]);

  if (!authed) return null;

  const logout = () => {
    setToken(null);
    nav('/admin/login', { replace: true });
  };

  const navCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3" fill="#f5a524" stroke="none" />
            <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="font-display font-bold text-ink-900">ADI ONG</p>
          <p className="text-xs font-semibold text-ink-400">Administration</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {visibleItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={navCls} onClick={() => setOpen(false)}>
            <MiniIcon d={it.icon} />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-100 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-cream px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 font-display text-xs font-bold text-white">
            {(savedUser?.full_name || savedUser?.email || 'A').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-900">{savedUser?.full_name || savedUser?.email || 'Admin'}</p>
            <p className="text-[11px] font-semibold text-brand-600">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
        <a href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-500 hover:bg-cream hover:text-ink-800">
          <MiniIcon d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          Voir le site
        </a>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
          <MiniIcon d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-white/90 px-5 py-4 shadow-soft backdrop-blur lg:hidden">
        <p className="font-display font-bold text-ink-900">Administration ADI</p>
        <button onClick={() => setOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-xl bg-ink-50 text-ink-700">
          <MiniIcon d={open ? 'M6 18 18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'} />
        </button>
      </div>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-ink-100 bg-white lg:block">{sidebar}</aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} />
            <aside className="absolute top-0 left-0 h-full w-72 bg-white shadow-lift">{sidebar}</aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
