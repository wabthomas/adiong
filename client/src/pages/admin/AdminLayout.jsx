import React, { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, getToken, setToken, getSavedUser, setSavedUser } from '../../api.js';

const ALL_ROLES = ['super_admin', 'admin', 'editor', 'viewer', 'cashier'];
const HR_ROLES = ['super_admin', 'admin'];
const POS_ROLES = ['super_admin', 'admin', 'cashier'];

const items = [
  { to: '/admin', label: 'Tableau de bord', roles: ALL_ROLES, icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z', end: true },
  { to: '/admin/articles', label: 'Articles', roles: ['super_admin', 'admin', 'editor'], icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V19.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.375c0-.621.504-1.125 1.125-1.125H2.25m12-1.5h3.375c.62 0 1.125.504 1.125 1.125V4.5m-2.625 5.5h5.25m-5.625 5h5.625' },
  { to: '/admin/causes', label: 'Causes', roles: ['super_admin', 'admin', 'editor'], icon: 'M12 3v2.25M6.375 6.375l1.59 1.59m5.46 0 1.59-1.59M3 12h2.25M18.75 12H21m-2.625 5.625-1.59-1.59m-5.46 0-1.59 1.59M12 18.75V21m0-3.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z' },
  { to: '/admin/campagnes', label: 'Campagnes', roles: ['super_admin', 'admin', 'editor'], icon: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
  { to: '/admin/partenaires', label: 'Partenaires', roles: ['super_admin', 'admin', 'editor'], icon: 'M11.42 15.17 17.25 21A2.625 2.625 0 0 0 21 18.25v-5.5A3.375 3.375 0 0 0 17.625 9H3.375A3.375 3.375 0 0 0 0 12.25v5.5A2.625 2.625 0 0 0 3.75 21l5.83-5.83a2.625 2.625 0 0 1 3.75 0ZM9.75 3.375A2.625 2.625 0 1 1 15 3.375 2.625 2.625 0 0 1 9.75 3.375Z' },
  { to: '/admin/dons', label: 'Dons', roles: ALL_ROLES, icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z' },
  { to: '/admin/messages', label: 'Messages', icon: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75' },
  { to: '/admin/grh', label: 'GRH (Ressources humaines)', roles: HR_ROLES, grh: true, icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0ZM7.5 14.25h9a3.375 3.375 0 0 1 0 6.75h-9a3.375 3.375 0 0 1 0-6.75Zm0 3.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z' },
  { to: '/admin/pos', label: 'Point de vente (POS)', roles: POS_ROLES, pos: true, icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z' },
  { to: '/admin/medias', label: 'Médiathèque', roles: ['super_admin', 'admin', 'editor'], icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z' },
  { to: '/admin/mon-espace', label: 'Mon espace (congés)', roles: ['super_admin', 'admin', 'editor', 'viewer'], grh: true, icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z' },
  { to: '/admin/profil', label: 'Mon profil', roles: ALL_ROLES, icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', roles: ['super_admin', 'admin'], icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
  { to: '/admin/parametres', label: 'Paramètres', roles: ['super_admin', 'admin'], icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z' }
];

function MiniIcon({ d, className = 'h-5 w-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Consultation', cashier: 'Caissier' };

function currentPage(pathname) {
  if (pathname === '/admin/profil') return { label: 'Mon profil' };
  return [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((it) => (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(`${it.to}/`)));
}

export default function AdminLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [authed] = useState(!!getToken());
  const [savedUser, setMe] = useState(getSavedUser);
  const [grhEnabled, setGrhEnabled] = useState(false);
  const [posEnabled, setPosEnabled] = useState(false);
  const menuRef = useRef(null);
  const role = savedUser?.role || 'admin';
  const page = currentPage(pathname);
  const initials = (savedUser?.full_name || savedUser?.email || 'A').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!getToken()) nav('/admin/login', { replace: true });
  }, [nav]);

  useEffect(() => {
    api.me.get().then((u) => { setSavedUser(u); setMe(u); }).catch(() => {});
    const sync = () => setMe(getSavedUser());
    window.addEventListener('adiong-user', sync);
    return () => window.removeEventListener('adiong-user', sync);
  }, []);

  useEffect(() => {
    if (HR_ROLES.includes(role) || POS_ROLES.includes(role)) {
      api.modules.get()
        .then((m) => {
          setGrhEnabled(!!m.grh_enabled);
          setPosEnabled(!!m.pos_enabled);
        })
        .catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const visibleItems = items
    .filter((it) => (it.roles || ALL_ROLES).includes(role))
    .filter((it) => !it.grh || grhEnabled)
    .filter((it) => !it.pos || posEnabled);

  if (!authed) return null;

  const logout = () => {
    api.logout().catch(() => {});
    setToken(null);
    nav('/admin/login', { replace: true });
  };

  const navCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3" fill="#fc7a03" stroke="none" />
            <path d="M5 18.5c1.4-4 4-5.5 7-5.5s5.6 1.5 7 5.5" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <p className="font-display font-bold text-ink-900">ADI ONG</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {visibleItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={navCls} onClick={() => setOpen(false)}>
            <MiniIcon d={it.icon} />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-100 lg:block">{sidebar}</aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} />
            <aside className="absolute top-0 left-0 h-full w-72 bg-white shadow-lift">{sidebar}</aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur-md">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-ink-50 text-ink-700 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <MiniIcon d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Espace admin</p>
                <h1 className="truncate font-display text-base font-bold text-ink-900 sm:text-lg">
                  {page?.label || 'Administration'}
                </h1>
              </div>

              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-brand-400 hover:text-brand-700 sm:inline-flex"
              >
                <MiniIcon d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" className="h-4 w-4" />
                Voir le site
              </a>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-ink-50"
                  aria-expanded={menu}
                >
                  <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-600 font-display text-xs font-bold text-white">
                    {savedUser?.photo ? (
                      <img src={savedUser.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[140px] truncate text-sm font-bold leading-tight text-ink-900">
                      {savedUser?.full_name || savedUser?.email || 'Admin'}
                    </span>
                    <span className="block text-[11px] font-semibold text-brand-600">{ROLE_LABELS[role] || role}</span>
                  </span>
                  <MiniIcon d="m19.5 8.25-7.5 7.5-7.5-7.5" className="hidden h-4 w-4 text-ink-400 sm:block" />
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl bg-white py-2 shadow-lift ring-1 ring-ink-950/5">
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-sm font-bold text-ink-900">{savedUser?.full_name || 'Admin'}</p>
                      <p className="truncate text-xs text-ink-400">{savedUser?.email}</p>
                    </div>
                    <a
                      href="/"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-cream sm:hidden"
                    >
                      <MiniIcon d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" className="h-4 w-4" />
                      Voir le site
                    </a>
                    <button
                      type="button"
                      onClick={() => nav('/admin/profil')}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-cream"
                    >
                      <MiniIcon d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" className="h-4 w-4" />
                      Mon profil
                    </button>
                    {['admin', 'super_admin'].includes(role) && (
                      <button
                        type="button"
                        onClick={() => nav('/admin/parametres')}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-cream"
                      >
                        <MiniIcon d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" className="h-4 w-4" />
                        Paramètres
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <MiniIcon d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" className="h-4 w-4" />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="grid min-h-[40vh] place-items-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
                  <p className="text-sm font-semibold text-ink-400">Chargement…</p>
                </div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        </div>
      </div>
    </div>
  );
}
